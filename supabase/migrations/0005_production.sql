-- =============================================================================
-- 0005 — Üretim altyapısı: tembel zaman değerlendirmesi
--
-- Brief madde 4: bina durumlarını ilerletmek için CRON YOK. Yalnızca
-- `state_since` saklanır; güncel durum okuma anında `now()` ile hesaplanır.
-- Yazma işlemleri (üretime başla, hasat et) durumu normalleştirir.
--
-- Brief madde 4 (ekonomi): para yaratımı ve yok oluşu açıkça takip edilmeli.
-- `ledger` tablosu her altın hareketini sebebiyle birlikte kaydeder.
-- =============================================================================

-- --- Mallara görsel alanlar ------------------------------------------------

alter table public.items
  add column if not exists color text not null default '#94a3b8',
  add column if not exists sort_order smallint not null default 0;

-- --- Hasat ödülü ------------------------------------------------------------

alter table public.object_types
  add column if not exists harvest_xp integer not null default 0
  check (harvest_xp >= 0);

-- --- Etkin durum ------------------------------------------------------------
-- Saklanan durum bayatlayabilir; gerçek durum her zaman buradan hesaplanır.
-- `stable` çünkü now() kullanıyor — aynı ifade içinde tutarlı, sorgular arasında değil.

create or replace function public.effective_state(
  p_state public.object_state,
  p_state_since timestamptz,
  p_build_seconds integer,
  p_produce_seconds integer
)
returns public.object_state
language sql
stable
as $$
  select case
    when p_state = 'building'
         and now() >= p_state_since + make_interval(secs => p_build_seconds)
      then 'idle'::public.object_state
    when p_state = 'producing'
         and p_produce_seconds is not null
         and now() >= p_state_since + make_interval(secs => p_produce_seconds)
      then 'ready'::public.object_state
    else p_state
  end;
$$;

/** Mevcut aşamanın biteceği an; boşta/hazır durumda null. */
create or replace function public.finishes_at(
  p_state public.object_state,
  p_state_since timestamptz,
  p_build_seconds integer,
  p_produce_seconds integer
)
returns timestamptz
language sql
immutable
as $$
  select case
    when p_state = 'building'  then p_state_since + make_interval(secs => p_build_seconds)
    when p_state = 'producing' then p_state_since + make_interval(secs => coalesce(p_produce_seconds, 0))
  end;
$$;

-- --- İstemcinin okuduğu görünüm ---------------------------------------------
-- `remaining_seconds` sunucuda hesaplanır: kullanıcının sistem saati yanlışsa
-- bile geri sayım doğru olur. İstemci bu sayıdan kendi monotonik saatiyle sayar.

create or replace view public.world_objects
with (security_invoker = on)
as
select
  po.id,
  po.owner_id,
  po.type_id,
  po.local_x,
  po.local_y,
  po.rotation,
  po.state,
  po.state_since,
  po.last_collected_at,
  public.effective_state(po.state, po.state_since, ot.build_seconds, ot.produce_seconds) as effective_state,
  public.finishes_at(po.state, po.state_since, ot.build_seconds, ot.produce_seconds) as finishes_at,
  greatest(
    0,
    ceil(extract(epoch from
      public.finishes_at(po.state, po.state_since, ot.build_seconds, ot.produce_seconds) - now()
    ))
  )::integer as remaining_seconds
from public.placed_objects po
join public.object_types ot on ot.id = po.type_id;

grant select on public.world_objects to authenticated;

-- --- Para defteri -----------------------------------------------------------
-- Her altın hareketi buraya yazılır. Brief madde 4: para çıkışının para girişine
-- oranı ölçülebilir olmalı; bu tablo o ölçümün kaynağıdır.

create type public.ledger_reason as enum (
  'build',          -- inşaat maliyeti (çıkış)
  'refund',         -- yıkım iadesi (giriş)
  'npc_sale',       -- NPC'ye mal satışı (giriş)
  'npc_purchase',   -- NPC'den mal alımı (çıkış)
  'maintenance',    -- bakım gideri (çıkış, Faz 4)
  'wages',          -- işçi ücreti (çıkış, Faz 4)
  'tax',            -- vergi (çıkış, Faz 7)
  'land'            -- arsa alımı (çıkış, Faz 3)
);

create table public.ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason public.ledger_reason not null,
  -- Pozitif = oyuncuya giren para, negatif = oyuncudan çıkan para.
  amount bigint not null,
  detail text,
  created_at timestamptz not null default now()
);

create index ledger_user_time_idx on public.ledger (user_id, created_at desc);
create index ledger_reason_idx on public.ledger (reason, created_at desc);

alter table public.ledger enable row level security;

create policy ledger_read_own on public.ledger
  for select to authenticated using (user_id = (select auth.uid()));

/** Tek yazma noktası; RPC'ler bunu çağırır. */
create or replace function public.record_ledger(
  p_user uuid,
  p_reason public.ledger_reason,
  p_amount bigint,
  p_detail text default null
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.ledger (user_id, reason, amount, detail)
  values (p_user, p_reason, p_amount, p_detail);
$$;

revoke all on function public.record_ledger(uuid, public.ledger_reason, bigint, text) from public;

-- --- Ekonomi sağlığı görünümü ----------------------------------------------
-- Ekonomiyi dengelerken bakılacak tek tablo: para yaratımı yok oluşunu geçiyor mu?

create or replace view public.money_flow
with (security_invoker = on)
as
select
  reason,
  count(*) as movements,
  sum(amount) filter (where amount > 0) as inflow,
  -sum(amount) filter (where amount < 0) as outflow,
  sum(amount) as net
from public.ledger
group by reason;

grant select on public.money_flow to authenticated;

-- --- Envanter yardımcısı ----------------------------------------------------

create or replace function public.add_to_inventory(
  p_user uuid,
  p_item text,
  p_quantity integer
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.inventory (user_id, item_id, quantity)
  values (p_user, p_item, p_quantity)
  on conflict (user_id, item_id)
  do update set quantity = public.inventory.quantity + excluded.quantity;
$$;

revoke all on function public.add_to_inventory(uuid, text, integer) from public;
