-- =============================================================================
-- 0009 — Bina seviyeleri, depo kapasitesi, elmas
--
-- Üç yeni fikir:
--  1. Her bina seviyelenir. Seviyenin etkisi (üretim, süre, kapasite) ve o
--     seviyeye çıkmanın bedeli (altın + malzeme + süre) TABLODA durur.
--  2. Mallar depoda tutulur ve kapasite sınırlıdır. Kapasite dolunca üretim
--     durur — depo yükseltmenin sebebi bu.
--  3. Elmas: bekleme süresini anında bitiren premium para.
--
-- Kural 6: buradaki hiçbir sayı koda gömülü değil.
-- =============================================================================

-- --- Elmas ------------------------------------------------------------------

alter table public.profiles
  add column if not exists gems integer not null default 0 check (gems >= 0);

-- --- Bina seviyesi ----------------------------------------------------------

alter table public.placed_objects
  add column if not exists level smallint not null default 1 check (level >= 1),
  -- Yükseltme sürerken hedef seviye burada bekler; süre dolunca `level` olur.
  add column if not exists pending_level smallint check (pending_level > 1),
  -- Sürekli üretimin biriktirme penceresinin başlangıcı.
  add column if not exists produced_since timestamptz;

-- --- Malların depo sınıfı ---------------------------------------------------
-- Tahıl zinciri ayrı depolanır (tahıl ambarı), diğer mallar ayrı (depo).

alter table public.items
  add column if not exists storage_class text not null default 'goods'
  check (storage_class in ('grain', 'goods'));

update public.items set storage_class = 'grain' where id in ('wheat', 'flour', 'bread');
update public.items set storage_class = 'goods' where id in ('timber', 'stone', 'cotton', 'cloth');

-- --- Binanın hangi depoyu beslediği -----------------------------------------

alter table public.object_types
  add column if not exists storage_class text
  check (storage_class is null or storage_class in ('grain', 'goods')),
  -- Yerleşim sırası: önce ham üreticiler toplanır, sonra işleyiciler.
  -- Böylece bir tur içinde tarla buğdayı verir, değirmen o buğdayı kullanır.
  add column if not exists tier smallint not null default 0,
  add column if not exists max_level smallint not null default 1 check (max_level >= 1);

update public.object_types set tier = 0 where input_item_id is null;
update public.object_types set tier = 1 where input_item_id is not null;

-- --- Seviye tabloları -------------------------------------------------------
-- `object_levels` satırı "bu seviyedeyken ne olur" ve "bu seviyeye çıkmak ne
-- kadar tutar" bilgisini birlikte taşır. Seviye 1'in bedeli yoktur.

create table if not exists public.object_levels (
  type_id text not null references public.object_types (id) on delete cascade,
  level smallint not null check (level between 1 and 50),
  produce_seconds integer check (produce_seconds > 0),
  output_qty integer check (output_qty > 0),
  input_qty integer check (input_qty > 0),
  storage_capacity integer not null default 0 check (storage_capacity >= 0),
  population_capacity integer not null default 0 check (population_capacity >= 0),
  worker_slots smallint not null default 0 check (worker_slots >= 0),
  -- Bu seviyeye ÇIKMANIN bedeli. Seviye 1'de null.
  upgrade_coins bigint check (upgrade_coins >= 0),
  upgrade_seconds integer check (upgrade_seconds >= 0),
  primary key (type_id, level)
);

create table if not exists public.object_level_costs (
  type_id text not null,
  level smallint not null,
  item_id text not null references public.items (id),
  quantity integer not null check (quantity > 0),
  primary key (type_id, level, item_id),
  foreign key (type_id, level) references public.object_levels (type_id, level) on delete cascade
);

alter table public.object_levels enable row level security;
alter table public.object_level_costs enable row level security;

create policy object_levels_read on public.object_levels
  for select to anon, authenticated using (true);

create policy object_level_costs_read on public.object_level_costs
  for select to anon, authenticated using (true);

-- --- Para defterine elmas ve yeni sebepler ----------------------------------

alter table public.ledger
  add column if not exists currency text not null default 'coin'
  check (currency in ('coin', 'gem'));

alter type public.ledger_reason add value if not exists 'upgrade';
alter type public.ledger_reason add value if not exists 'rush';
alter type public.ledger_reason add value if not exists 'starting_grant';

-- --- Yeni ayarlar -----------------------------------------------------------

insert into public.game_config (key, value, description) values
  ('starting_gems',        '1000', 'Yeni oyuncunun başlangıç elması'),
  ('base_storage_grain',   '200',  'Depo binası olmadan tahıl kapasitesi'),
  ('base_storage_goods',   '200',  'Depo binası olmadan mal kapasitesi'),
  ('gems_per_minute',      '2',    'Bekleme süresini elmasla atlamanın dakika başına bedeli'),
  ('rush_min_gems',        '1',    'Anında bitirmenin en düşük bedeli')
on conflict (key) do update set value = excluded.value, description = excluded.description;

-- Mevcut oyunculara başlangıç elması.
-- NOT: `ledger.reason` üzerinden kontrol edemiyoruz; PostgreSQL yeni enum
-- değerinin eklendiği işlem içinde kullanılmasına izin vermiyor. Migration
-- yalnızca bir kez çalıştığı için düz koşul yeterli.
update public.profiles
   set gems = (select (value #>> '{}')::integer from public.game_config where key = 'starting_gems')
 where gems = 0;
