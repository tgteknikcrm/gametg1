-- =============================================================================
-- 0013 — GÜVENLİK: iç yardımcı fonksiyonları dışarıya kapat
--
-- AÇIK: `revoke all on function ... from public` yeterli DEĞİL.
-- Supabase kurulumunda şu satır vardır:
--     alter default privileges in schema public
--       grant all on functions to postgres, anon, authenticated, service_role;
-- Bu, PUBLIC sözde-rolüne değil, `anon` ve `authenticated` rollerine AYRI ve
-- AÇIK bir grant yazar. PUBLIC'ten revoke etmek o grant'ları kaldırmaz.
--
-- Sonuç: `add_to_inventory` ve `record_ledger` gibi `auth.uid()` kontrolü
-- OLMAYAN, kullanıcıyı parametreden alan SECURITY DEFINER yardımcıları
-- PostgREST üzerinden giriş yapmadan çağrılabiliyordu:
--     POST /rest/v1/rpc/add_to_inventory {"p_user":"<uuid>","p_item":"bread","p_quantity":1000000}
-- ardından meşru `sell_item` ile sınırsız altın. Ayrıca başka bir oyuncunun
-- envanterine yazmak da mümkündü.
--
-- ÇÖZÜM — üç katman:
--   1. Yazan yardımcılar PostgREST'in hiç görmediği `internal` şemasına taşındı.
--   2. `public` şemasındaki TÜM fonksiyonlardan anon/authenticated yetkisi
--      alındı; yalnızca oyuncuya açık RPC'ler tek tek geri verildi.
--   3. Salt okunan yardımcılardan SECURITY DEFINER kaldırıldı; artık RLS
--      çağıranın kimliğine göre işliyor (başkasının ambarı görünmüyor).
-- =============================================================================

create schema if not exists internal;
revoke all on schema internal from public, anon, authenticated;
grant usage on schema internal to postgres;

-- --- 1. Yazan yardımcıları API'nin göremeyeceği şemaya taşı -----------------

alter function public.add_to_inventory(uuid, text, integer) set schema internal;
alter function public.record_ledger(uuid, public.ledger_reason, bigint, text) set schema internal;
alter function public.apply_level_up(uuid) set schema internal;
alter function public.active_parcel(uuid) set schema internal;
alter function public.handle_new_user() set schema internal;

-- --- 2. Salt okunan yardımcılardan SECURITY DEFINER'ı kaldır ----------------
-- Bunlar `world_objects` / `storage_status` görünümlerinden çağrılıyor ve o
-- görünümler `security_invoker = on`. Definer olmadıkları için artık RLS
-- çağıranın kimliğine göre uygulanıyor: başkasının envanteri 0 döner.

create or replace function public.storage_capacity(p_user uuid, p_class text)
returns integer
language sql
stable
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
           and now() >= po.state_since + make_interval(secs => po.state_duration)
      ), 0)::integer;
$$;

create or replace function public.stored_amount(p_user uuid, p_class text)
returns integer
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(sum(inv.quantity), 0)::integer
    from public.inventory inv
    join public.items i on i.id = inv.item_id
   where inv.user_id = p_user and i.storage_class = p_class;
$$;

-- --- 3. Taşınan yardımcıları çağıran fonksiyonları yeniden yaz --------------
-- `search_path` içine `internal` eklendi; çağrılar açıkça nitelendirildi.

create or replace function public.place_object(
  p_type_id text, p_x integer, p_y integer, p_rotation integer
)
returns public.placed_objects
language plpgsql
security definer
set search_path = public, internal, pg_temp
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

  v_parcel := internal.active_parcel(v_profile.city_id);
  if v_parcel.id is null then raise exception 'parcel_missing'; end if;

  select w, h into v_w, v_h from public.rotated_footprint(v_type.width, v_type.height, p_rotation);
  if p_x < 0 or p_y < 0 or p_x + v_w > v_parcel.width or p_y + v_h > v_parcel.height then
    raise exception 'out_of_bounds';
  end if;

  begin
    insert into public.placed_objects (
      parcel_id, owner_id, type_id, local_x, local_y, rotation,
      footprint_w, footprint_h, state, state_since, state_duration, level, produced_since
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

  perform internal.apply_level_up(v_user);
  perform internal.record_ledger(v_user, 'build', -v_type.cost, v_type.id);

  return v_row;
end;
$$;

create or replace function public.remove_object(p_object_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public, internal, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_obj public.placed_objects;
  v_type public.object_types;
  v_refund bigint;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_obj from public.placed_objects where id = p_object_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_obj.owner_id <> v_user then raise exception 'not_owner'; end if;

  perform 1 from public.profiles where id = v_user for update;

  select * into v_type from public.object_types where id = v_obj.type_id;
  v_refund := floor(v_type.cost * v_type.refund_rate);

  delete from public.placed_objects where id = p_object_id;
  update public.profiles set coins = coins + v_refund where id = v_user;
  perform internal.record_ledger(v_user, 'refund', v_refund, v_type.id);

  return v_refund;
end;
$$;

create or replace function public.sell_item(p_item_id text, p_quantity integer)
returns bigint
language plpgsql
security definer
set search_path = public, internal, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_item public.items;
  v_have integer;
  v_total bigint;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid_quantity'; end if;

  select * into v_item from public.items where id = p_item_id;
  if not found then raise exception 'unknown_item'; end if;

  perform 1 from public.profiles where id = v_user for update;

  select quantity into v_have
    from public.inventory where user_id = v_user and item_id = p_item_id for update;
  if coalesce(v_have, 0) < p_quantity then raise exception 'insufficient_items'; end if;

  v_total := p_quantity::bigint * v_item.npc_buy_price;

  update public.inventory set quantity = quantity - p_quantity
   where user_id = v_user and item_id = p_item_id;
  update public.profiles set coins = coins + v_total where id = v_user;
  perform internal.record_ledger(v_user, 'npc_sale', v_total, p_item_id || ' x' || p_quantity);

  return v_total;
end;
$$;

create or replace function public.buy_item(p_item_id text, p_quantity integer)
returns bigint
language plpgsql
security definer
set search_path = public, internal, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_item public.items;
  v_coins bigint;
  v_total bigint;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid_quantity'; end if;

  select * into v_item from public.items where id = p_item_id;
  if not found then raise exception 'unknown_item'; end if;

  select coins into v_coins from public.profiles where id = v_user for update;
  v_total := p_quantity::bigint * v_item.npc_sell_price;
  if v_coins < v_total then raise exception 'insufficient_funds'; end if;

  update public.profiles set coins = coins - v_total where id = v_user;
  perform internal.add_to_inventory(v_user, p_item_id, p_quantity);
  perform internal.record_ledger(v_user, 'npc_purchase', -v_total, p_item_id || ' x' || p_quantity);

  return v_total;
end;
$$;

-- --- 4. Yetkileri sıfırdan kur ----------------------------------------------
-- Önce her şeyi kapat, sonra yalnızca oyuncunun çağırması gerekenleri aç.

alter default privileges in schema public revoke execute on functions from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated;
revoke execute on all functions in schema internal from anon, authenticated, public;

grant execute on function public.place_object(text, integer, integer, integer) to authenticated;
grant execute on function public.move_object(uuid, integer, integer, integer) to authenticated;
grant execute on function public.remove_object(uuid) to authenticated;
grant execute on function public.collect_all() to authenticated;
grant execute on function public.upgrade_object(uuid) to authenticated;
grant execute on function public.rush_object(uuid) to authenticated;
grant execute on function public.sell_item(text, integer) to authenticated;
grant execute on function public.buy_item(text, integer) to authenticated;

-- Görünümler `security_invoker = on` olduğu için çağıranın bu üç saf okuma
-- fonksiyonunu çalıştırabilmesi gerekiyor. Üçü de yalnızca okur ve artık
-- definer değil, yani RLS çağıranın kimliğine göre uygulanıyor.
grant execute on function public.object_stats(text, smallint) to authenticated;
grant execute on function public.storage_capacity(uuid, text) to authenticated;
grant execute on function public.stored_amount(uuid, text) to authenticated;
