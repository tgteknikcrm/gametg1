-- =============================================================================
-- 0001 — Çekirdek şema
--
-- Tasarım notları:
--  * Tüm denge verisi tablolarda (object_types, level_thresholds, game_config).
--    Ekonomiyi yeniden dengelemek için SQL UPDATE yeter, yeniden dağıtım gerekmez.
--  * placed_objects üzerindeki EXCLUDE kısıtı, çakışan yerleştirmeyi VERİTABANI
--    seviyesinde imkânsız kılar. İki sekme aynı anda aynı hücreye inşa edemez —
--    uygulama mantığına değil, kısıta güveniyoruz.
-- =============================================================================

create extension if not exists btree_gist;

-- --- Enum'lar ---------------------------------------------------------------
create type public.object_category as enum ('production', 'housing', 'civic', 'decor');
create type public.object_state as enum ('building', 'idle', 'producing', 'ready', 'needs_workers');

-- --- Ayar ve ilerleme tabloları ---------------------------------------------

-- Kod içinde sabit olmaması gereken her sayı burada.
create table public.game_config (
  key text primary key,
  value jsonb not null,
  description text
);

-- Seviye eşikleri: level N'e çıkmak için gereken XP.
create table public.level_thresholds (
  level smallint primary key check (level >= 1),
  xp_required integer not null check (xp_required > 0)
);

-- --- Ekonomi tabloları ------------------------------------------------------

-- npc_buy_price : NPC oyuncudan alırken ÖDEDİĞİ fiyat (oyuncunun geliri)
-- npc_sell_price: NPC oyuncuya satarken İSTEDİĞİ fiyat (oyuncunun gideri)
create table public.items (
  id text primary key,
  name text not null,
  npc_buy_price integer not null default 0 check (npc_buy_price >= 0),
  npc_sell_price integer not null default 0 check (npc_sell_price >= 0),
  npc_daily_consumption integer not null default 0 check (npc_daily_consumption >= 0)
);

-- NPC'den alıp NPC'ye satarak para basılamamalı: satış fiyatı alış fiyatının
-- üstünde olmak zorunda. Aradaki fark brief madde 4'teki para çıkışlarından biri.
alter table public.items
  add constraint items_price_spread
  check (npc_sell_price >= npc_buy_price or npc_sell_price = 0);

create table public.object_types (
  id text primary key,
  category public.object_category not null,
  name text not null,
  model_key text not null,
  width smallint not null check (width between 1 and 20),
  height smallint not null check (height between 1 and 20),
  cost bigint not null check (cost >= 0),
  build_seconds integer not null default 0 check (build_seconds >= 0),
  produce_seconds integer check (produce_seconds > 0),
  input_item_id text references public.items (id),
  input_qty integer check (input_qty > 0),
  output_item_id text references public.items (id),
  output_qty integer check (output_qty > 0),
  worker_slots smallint not null default 0 check (worker_slots >= 0),
  population_capacity integer not null default 0 check (population_capacity >= 0),
  maintenance_per_hour integer not null default 0 check (maintenance_per_hour >= 0),
  level_required smallint not null default 1 check (level_required >= 1),
  refund_rate numeric(4, 3) not null default 0.500 check (refund_rate between 0 and 1),
  xp_reward integer not null default 0 check (xp_reward >= 0),
  -- Faz 0/1 kutu görselleştirmesi. GLB'ye geçince model_key devralacak.
  color text not null,
  block_height numeric(4, 2) not null check (block_height > 0),
  sort_order smallint not null default 0,
  is_active boolean not null default true
);

-- --- Şehir ve oyuncu --------------------------------------------------------

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mayor_user_id uuid,
  treasury bigint not null default 0,
  tax_rate numeric(5, 4) not null default 0.0500 check (tax_rate between 0 and 1),
  population integer not null default 0 check (population >= 0),
  center_x integer not null default 0,
  center_y integer not null default 0,
  active_rings smallint not null default 1 check (active_rings >= 1),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 24),
  city_id uuid references public.cities (id),
  coins bigint not null default 0 check (coins >= 0),
  xp integer not null default 0 check (xp >= 0),
  level smallint not null default 1 check (level >= 1),
  energy smallint not null default 60 check (energy >= 0),
  energy_updated_at timestamptz not null default now(),
  stat_education smallint not null default 0 check (stat_education >= 0),
  stat_culture smallint not null default 0 check (stat_culture >= 0),
  stat_health smallint not null default 0 check (stat_health >= 0),
  stat_charisma smallint not null default 0 check (stat_charisma >= 0),
  created_at timestamptz not null default now()
);

alter table public.cities
  add constraint cities_mayor_fkey
  foreign key (mayor_user_id) references public.profiles (id) on delete set null;

-- --- Arsa -------------------------------------------------------------------
-- Faz 1'de şehirde tek bir paylaşılan parsel var (ring 0). Halka mantığı,
-- mesafeye göre fiyat ve sahiplik Faz 3'te bu tabloya eklenecek.

create table public.parcels (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete cascade,
  ring smallint not null default 0 check (ring >= 0),
  x integer not null,
  y integer not null,
  width smallint not null check (width > 0),
  height smallint not null check (height > 0),
  owner_id uuid references public.profiles (id) on delete set null,
  base_price bigint not null default 0 check (base_price >= 0),
  purchased_at timestamptz,
  unique (city_id, x, y)
);

-- --- Yerleştirilmiş nesneler ------------------------------------------------

create table public.placed_objects (
  id uuid primary key default gen_random_uuid(),
  parcel_id uuid not null references public.parcels (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  type_id text not null references public.object_types (id),
  local_x smallint not null check (local_x >= 0),
  local_y smallint not null check (local_y >= 0),
  rotation smallint not null default 0 check (rotation in (0, 90, 180, 270)),
  -- Rotasyon UYGULANMIŞ ayak izi. RPC yazar; çakışma kısıtı bunu okur.
  footprint_w smallint not null check (footprint_w > 0),
  footprint_h smallint not null check (footprint_h > 0),
  state public.object_state not null default 'idle',
  state_since timestamptz not null default now(),
  workers_assigned smallint not null default 0 check (workers_assigned >= 0),
  last_collected_at timestamptz,
  created_at timestamptz not null default now(),
  -- Kapladığı alanın kutusu. Kenarlardan 0.1 içeri çekildi: bitişik binalar
  -- kenar paylaştığı için "çakışıyor" sayılmasın. Gerçek çakışma en az bir tam
  -- hücre olduğundan 0.1'lik boşluk tespiti bozmaz.
  footprint box generated always as (
    box(
      point((local_x + 0.1)::float8, (local_y + 0.1)::float8),
      point((local_x + footprint_w - 0.1)::float8, (local_y + footprint_h - 0.1)::float8)
    )
  ) stored
);

-- Çakışmayı uygulama değil veritabanı engeller.
alter table public.placed_objects
  add constraint placed_objects_no_overlap
  exclude using gist (parcel_id with =, footprint with &&);

create index placed_objects_parcel_idx on public.placed_objects (parcel_id);
create index placed_objects_owner_idx on public.placed_objects (owner_id);

-- --- Envanter ve pazar (Faz 2 / Faz 6'da doldurulacak) ----------------------

create table public.inventory (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.items (id),
  quantity integer not null default 0 check (quantity >= 0),
  primary key (user_id, item_id)
);

create table public.market_orders (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.items (id),
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price > 0),
  created_at timestamptz not null default now()
);

create index market_orders_city_item_idx on public.market_orders (city_id, item_id, unit_price);
