-- =============================================================================
-- 0011 — Sürekli üretim, yükseltme, elmasla anında bitirme
--
-- ÖNEMLİ DEĞİŞİKLİK: "üretime başla / hasat et" tıklama döngüsü kalktı.
-- Binalar inşaat bitince kendiliğinden ve kesintisiz üretir. Üretim tembel
-- hesaplanır: `produced_since`'ten bu yana kaç tur geçtiyse o kadar mal birikir.
-- Oyuncu oyunda olmasa bile birikir; toplandığında envantere geçer.
--
-- Zamanlı durum artık tek bir şey: `building`. Hem ilk inşaat hem yükseltme
-- bunu kullanır, süresi `state_duration` kolonunda durur. `producing`/`ready`
-- durumları emekliye ayrıldı.
-- =============================================================================

-- Zamanlı durumun süresi satırda dursun: yükseltme ile inşaat farklı sürer,
-- her seferinde object_types'a bakmak zorunda kalmayalım.
alter table public.placed_objects
  add column if not exists state_duration integer not null default 0 check (state_duration >= 0);

update public.placed_objects po
   set state_duration = ot.build_seconds
  from public.object_types ot
 where ot.id = po.type_id and po.state_duration = 0;

-- Eski döngüde kalmış binaları yeni modele taşı.
update public.placed_objects set state = 'idle' where state in ('producing', 'ready');

-- --- Seviyeye göre etkin değerler -------------------------------------------

create or replace function public.object_stats(p_type_id text, p_level smallint)
returns table (
  produce_seconds integer,
  output_qty integer,
  input_qty integer,
  storage_capacity integer,
  population_capacity integer,
  worker_slots smallint
)
language sql
stable
as $$
  select
    coalesce(ol.produce_seconds, ot.produce_seconds),
    coalesce(ol.output_qty, ot.output_qty),
    coalesce(ol.input_qty, ot.input_qty),
    coalesce(ol.storage_capacity, 0),
    coalesce(nullif(ol.population_capacity, 0), ot.population_capacity),
    coalesce(nullif(ol.worker_slots, 0::smallint), ot.worker_slots)
  from public.object_types ot
  left join public.object_levels ol
    on ol.type_id = ot.id and ol.level = p_level
  where ot.id = p_type_id;
$$;

-- --- Depo kapasitesi ---------------------------------------------------------

create or replace function public.storage_capacity(p_user uuid, p_class text)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
      (select (value #>> '{}')::integer from public.game_config where key = 'base_storage_' || p_class), 0)
    + coalesce((
        select sum(coalesce(ol.storage_capacity, 0))
          from public.placed_objects po
          join public.object_types ot on ot.id = po.type_id
          left join public.object_levels ol on ol.type_id = ot.id and ol.level = po.level
         where po.owner_id = p_user
           and ot.storage_class = p_class
           -- İnşaatı bitmemiş depo kapasite vermez.
           and now() >= po.state_since + make_interval(secs => po.state_duration)
      ), 0)::integer;
$$;

create or replace function public.stored_amount(p_user uuid, p_class text)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(inv.quantity), 0)::integer
    from public.inventory inv
    join public.items i on i.id = inv.item_id
   where inv.user_id = p_user and i.storage_class = p_class;
$$;

-- --- İstemcinin okuduğu görünüm ---------------------------------------------

drop view if exists public.world_objects;

create view public.world_objects
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
  po.state_duration,
  po.level,
  po.pending_level,
  po.produced_since,
  po.last_collected_at,
  t.finishes_at,
  case when t.busy then 'building'::public.object_state else 'idle'::public.object_state end as effective_state,
  greatest(0, ceil(extract(epoch from t.finishes_at - now())))::integer as remaining_seconds,
  e.effective_level,
  st.produce_seconds as cycle_seconds,
  st.output_qty as cycle_output,
  st.input_qty as cycle_input,
  c.pending_cycles,
  c.pending_cycles * coalesce(st.output_qty, 0) as pending_qty,
  c.cycle_remaining_seconds
from public.placed_objects po
join public.object_types ot on ot.id = po.type_id
cross join lateral (
  select po.state_since + make_interval(secs => po.state_duration) as finishes_at
) f
cross join lateral (
  select f.finishes_at as finishes_at, now() < f.finishes_at as busy
) t
cross join lateral (
  -- Yükseltme süresi dolduysa gerçek seviye hedef seviyedir.
  select case when t.busy then po.level else coalesce(po.pending_level, po.level) end as effective_level
) e
cross join lateral public.object_stats(po.type_id, e.effective_level) st
cross join lateral (
  select
    case
      when st.produce_seconds is null or po.produced_since is null then 0
      else greatest(0, floor(extract(epoch from now() - po.produced_since) / st.produce_seconds))::integer
    end as pending_cycles,
    case
      when st.produce_seconds is null or po.produced_since is null then null
      when now() < po.produced_since then ceil(extract(epoch from po.produced_since - now()))::integer
      else st.produce_seconds
           - floor(mod(extract(epoch from now() - po.produced_since)::numeric, st.produce_seconds))::integer
    end as cycle_remaining_seconds
) c;

grant select on public.world_objects to authenticated;

-- --- Oyuncunun deposu --------------------------------------------------------

create or replace view public.storage_status
with (security_invoker = on)
as
select
  p.id as user_id,
  cls.storage_class,
  public.stored_amount(p.id, cls.storage_class) as stored,
  public.storage_capacity(p.id, cls.storage_class) as capacity
from public.profiles p
cross join (values ('grain'), ('goods')) as cls(storage_class)
where p.id = (select auth.uid());

grant select on public.storage_status to authenticated;

-- --- Biriken üretimi topla ---------------------------------------------------

create or replace function public.collect_all()
returns table (collected integer, items jsonb, blocked_full boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row record;
  v_cycles integer;
  v_have integer;
  v_free integer;
  v_class text;
  v_total integer := 0;
  v_items jsonb := '{}'::jsonb;
  v_blocked boolean := false;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  perform 1 from public.profiles where id = v_user for update;

  -- Önce ham üreticiler (tier 0), sonra işleyiciler (tier 1): tek turda
  -- tarla buğdayı verir, değirmen o buğdayı kullanabilir.
  for v_row in
    select po.id, po.type_id, po.produced_since, ot.tier,
           st.produce_seconds, st.output_qty, st.input_qty,
           ot.input_item_id, ot.output_item_id,
           oi.storage_class as out_class
      from public.placed_objects po
      join public.object_types ot on ot.id = po.type_id
      left join public.items oi on oi.id = ot.output_item_id
      cross join lateral public.object_stats(
        po.type_id,
        case when now() < po.state_since + make_interval(secs => po.state_duration)
             then po.level else coalesce(po.pending_level, po.level) end
      ) st
     where po.owner_id = v_user
       and ot.produce_seconds is not null
       and po.produced_since is not null
       and now() >= po.state_since + make_interval(secs => po.state_duration)
     order by ot.tier, po.created_at
     for update of po
  loop
    v_cycles := floor(extract(epoch from now() - v_row.produced_since) / v_row.produce_seconds)::integer;
    if v_cycles <= 0 then continue; end if;

    -- Hammadde sınırı
    if v_row.input_item_id is not null then
      select coalesce(quantity, 0) into v_have
        from public.inventory where user_id = v_user and item_id = v_row.input_item_id for update;
      v_cycles := least(v_cycles, floor(coalesce(v_have, 0) / v_row.input_qty)::integer);
      if v_cycles <= 0 then continue; end if;
    end if;

    -- Depo sınırı
    v_class := coalesce(v_row.out_class, 'goods');
    v_free := public.storage_capacity(v_user, v_class) - public.stored_amount(v_user, v_class);
    if v_free <= 0 then
      v_blocked := true;
      continue;
    end if;
    if v_cycles * v_row.output_qty > v_free then
      v_blocked := true;
      v_cycles := floor(v_free / v_row.output_qty)::integer;
      if v_cycles <= 0 then continue; end if;
    end if;

    if v_row.input_item_id is not null then
      update public.inventory
         set quantity = quantity - v_cycles * v_row.input_qty
       where user_id = v_user and item_id = v_row.input_item_id;
    end if;

    perform public.add_to_inventory(v_user, v_row.output_item_id, v_cycles * v_row.output_qty);

    -- Kısmi ilerleme kaybolmasın: `now()` değil, tamamlanan turlar kadar ilerlet.
    update public.placed_objects
       set produced_since = produced_since + make_interval(secs => v_cycles * v_row.produce_seconds),
           last_collected_at = now()
     where id = v_row.id;

    v_total := v_total + v_cycles * v_row.output_qty;
    v_items := jsonb_set(
      v_items,
      array[v_row.output_item_id],
      to_jsonb(coalesce((v_items ->> v_row.output_item_id)::integer, 0) + v_cycles * v_row.output_qty)
    );
  end loop;

  return query select v_total, v_items, v_blocked;
end;
$$;

-- --- Yükseltme ---------------------------------------------------------------

create or replace function public.upgrade_object(p_object_id uuid)
returns public.placed_objects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_obj public.placed_objects;
  v_type public.object_types;
  v_target smallint;
  v_next public.object_levels;
  v_cost record;
  v_have integer;
  v_coins bigint;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_obj from public.placed_objects where id = p_object_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_obj.owner_id <> v_user then raise exception 'not_owner'; end if;

  if now() < v_obj.state_since + make_interval(secs => v_obj.state_duration) then
    raise exception 'still_building';
  end if;

  -- Süresi dolmuş bir yükseltme varsa önce onu kalıcı yap.
  if v_obj.pending_level is not null then
    update public.placed_objects
       set level = v_obj.pending_level, pending_level = null
     where id = p_object_id
     returning * into v_obj;
  end if;

  select * into v_type from public.object_types where id = v_obj.type_id;
  v_target := (v_obj.level + 1)::smallint;
  if v_target > v_type.max_level then raise exception 'max_level'; end if;

  select * into v_next from public.object_levels where type_id = v_obj.type_id and level = v_target;
  if not found or v_next.upgrade_coins is null then raise exception 'not_upgradable'; end if;

  select coins into v_coins from public.profiles where id = v_user for update;
  if v_coins < v_next.upgrade_coins then raise exception 'insufficient_funds'; end if;

  -- Malzeme kontrolü — hepsi yetmiyorsa hiçbiri harcanmaz.
  for v_cost in
    select item_id, quantity from public.object_level_costs
     where type_id = v_obj.type_id and level = v_target
  loop
    select coalesce(quantity, 0) into v_have
      from public.inventory where user_id = v_user and item_id = v_cost.item_id for update;
    if coalesce(v_have, 0) < v_cost.quantity then raise exception 'missing_materials'; end if;
  end loop;

  for v_cost in
    select item_id, quantity from public.object_level_costs
     where type_id = v_obj.type_id and level = v_target
  loop
    update public.inventory set quantity = quantity - v_cost.quantity
     where user_id = v_user and item_id = v_cost.item_id;
  end loop;

  update public.profiles set coins = coins - v_next.upgrade_coins where id = v_user;
  perform public.record_ledger(v_user, 'upgrade', -v_next.upgrade_coins, v_obj.type_id || ' → sv' || v_target);

  update public.placed_objects
     set state = 'building',
         state_since = now(),
         state_duration = coalesce(v_next.upgrade_seconds, 0),
         pending_level = v_target,
         -- Yükseltme boyunca üretim durur; biten anda yeni seviyeyle başlar.
         produced_since = now() + make_interval(secs => coalesce(v_next.upgrade_seconds, 0))
   where id = p_object_id
   returning * into v_obj;

  return v_obj;
end;
$$;

-- --- Elmasla anında bitirme --------------------------------------------------

create or replace function public.rush_object(p_object_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_obj public.placed_objects;
  v_remaining numeric;
  v_per_minute integer;
  v_min integer;
  v_cost integer;
  v_gems integer;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_obj from public.placed_objects where id = p_object_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_obj.owner_id <> v_user then raise exception 'not_owner'; end if;

  v_remaining := extract(epoch from (v_obj.state_since + make_interval(secs => v_obj.state_duration)) - now());
  if v_remaining <= 0 then raise exception 'nothing_to_rush'; end if;

  select (value #>> '{}')::integer into v_per_minute from public.game_config where key = 'gems_per_minute';
  select (value #>> '{}')::integer into v_min from public.game_config where key = 'rush_min_gems';
  v_cost := greatest(coalesce(v_min, 1), ceil(v_remaining / 60.0 * coalesce(v_per_minute, 2))::integer);

  select gems into v_gems from public.profiles where id = v_user for update;
  if v_gems < v_cost then raise exception 'insufficient_gems'; end if;

  update public.profiles set gems = gems - v_cost where id = v_user;
  perform public.record_ledger(v_user, 'rush', -v_cost, v_obj.type_id);
  update public.ledger set currency = 'gem'
   where id = (select max(id) from public.ledger where user_id = v_user);

  update public.placed_objects
     set state_since = now() - make_interval(secs => state_duration),
         level = coalesce(pending_level, level),
         pending_level = null,
         produced_since = least(coalesce(produced_since, now()), now())
   where id = p_object_id;

  return v_cost;
end;
$$;

-- --- place_object: yeni kolonları doldur -------------------------------------

create or replace function public.place_object(
  p_type_id text,
  p_x integer,
  p_y integer,
  p_rotation integer
)
returns public.placed_objects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_type public.object_types;
  v_parcel public.parcels;
  v_w smallint;
  v_h smallint;
  v_row public.placed_objects;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_profile from public.profiles where id = v_user for update;
  if not found then raise exception 'profile_missing'; end if;

  if p_rotation is null or p_rotation not in (0, 90, 180, 270) then
    raise exception 'invalid_rotation';
  end if;

  select * into v_type from public.object_types where id = p_type_id and is_active;
  if not found then raise exception 'unknown_type'; end if;
  if v_profile.level < v_type.level_required then raise exception 'level_required'; end if;
  if v_profile.coins < v_type.cost then raise exception 'insufficient_funds'; end if;

  v_parcel := public.active_parcel(v_profile.city_id);
  if v_parcel.id is null then raise exception 'parcel_missing'; end if;

  select w, h into v_w, v_h from public.rotated_footprint(v_type.width, v_type.height, p_rotation);
  if p_x < 0 or p_y < 0 or p_x + v_w > v_parcel.width or p_y + v_h > v_parcel.height then
    raise exception 'out_of_bounds';
  end if;

  begin
    insert into public.placed_objects (
      parcel_id, owner_id, type_id, local_x, local_y, rotation,
      footprint_w, footprint_h, state, state_since, state_duration, level,
      -- Üretim penceresi inşaat biter bitmez açılır.
      produced_since
    ) values (
      v_parcel.id, v_user, v_type.id, p_x, p_y, p_rotation,
      v_w, v_h,
      case when v_type.build_seconds > 0 then 'building'::public.object_state
           else 'idle'::public.object_state end,
      now(), v_type.build_seconds, 1,
      now() + make_interval(secs => v_type.build_seconds)
    )
    returning * into v_row;
  exception
    when exclusion_violation then raise exception 'cell_occupied';
  end;

  update public.profiles
     set coins = coins - v_type.cost, xp = xp + v_type.xp_reward
   where id = v_user;

  perform public.apply_level_up(v_user);
  perform public.record_ledger(v_user, 'build', -v_type.cost, v_type.id);

  return v_row;
end;
$$;

-- --- Emekliye ayrılan fonksiyonlar -------------------------------------------
-- Tıklamalı üretim döngüsü kalktı; bu yüzeyleri açık bırakmıyoruz.

drop function if exists public.start_production(uuid);
drop function if exists public.harvest_object(uuid);
drop function if exists public.harvest_all();

-- --- Yetkiler ----------------------------------------------------------------

revoke all on function public.collect_all() from public;
revoke all on function public.upgrade_object(uuid) from public;
revoke all on function public.rush_object(uuid) from public;
revoke all on function public.object_stats(text, smallint) from public;
revoke all on function public.storage_capacity(uuid, text) from public;
revoke all on function public.stored_amount(uuid, text) from public;

grant execute on function public.collect_all() to authenticated;
grant execute on function public.upgrade_object(uuid) to authenticated;
grant execute on function public.rush_object(uuid) to authenticated;
grant execute on function public.object_stats(text, smallint) to authenticated;
grant execute on function public.storage_capacity(uuid, text) to authenticated;
grant execute on function public.stored_amount(uuid, text) to authenticated;
