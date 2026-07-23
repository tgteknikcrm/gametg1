-- =============================================================================
-- 0014 — Üretim fonksiyonlarını `internal` yardımcılara bağla
--
-- 0013 yardımcıları `internal` şemasına taşıdı ama üretim tarafındaki üç
-- fonksiyon hâlâ `public.add_to_inventory` / `public.record_ledger` çağırıyordu
-- ve 42883 ile patlıyordu. Testler yakaladı; burada düzeltiliyor.
-- =============================================================================

create or replace function public.collect_all()
returns table (collected integer, items jsonb, blocked_full boolean)
language plpgsql
security definer
set search_path = public, internal, pg_temp
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

    if v_row.input_item_id is not null then
      select coalesce(quantity, 0) into v_have
        from public.inventory where user_id = v_user and item_id = v_row.input_item_id for update;
      v_cycles := least(v_cycles, floor(coalesce(v_have, 0) / v_row.input_qty)::integer);
      if v_cycles <= 0 then continue; end if;
    end if;

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

    perform internal.add_to_inventory(v_user, v_row.output_item_id, v_cycles * v_row.output_qty);

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

create or replace function public.upgrade_object(p_object_id uuid)
returns public.placed_objects
language plpgsql
security definer
set search_path = public, internal, pg_temp
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
  perform internal.record_ledger(v_user, 'upgrade', -v_next.upgrade_coins, v_obj.type_id || ' → sv' || v_target);

  update public.placed_objects
     set state = 'building',
         state_since = now(),
         state_duration = coalesce(v_next.upgrade_seconds, 0),
         pending_level = v_target,
         produced_since = now() + make_interval(secs => coalesce(v_next.upgrade_seconds, 0))
   where id = p_object_id
   returning * into v_obj;

  return v_obj;
end;
$$;

create or replace function public.rush_object(p_object_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, internal, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_obj public.placed_objects;
  v_remaining numeric;
  v_per_minute integer;
  v_min integer;
  v_cost integer;
  v_gems integer;
  v_ledger_id bigint;
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

  -- Defter kaydını yaz ve para birimini elmas olarak işaretle. Kendi eklediğimiz
  -- satırı id ile yakalıyoruz; "en son satır" varsayımı eşzamanlı çağrıda yanılır.
  insert into public.ledger (user_id, reason, amount, detail, currency)
  values (v_user, 'rush', -v_cost, v_obj.type_id, 'gem')
  returning id into v_ledger_id;

  update public.placed_objects
     set state_since = now() - make_interval(secs => state_duration),
         level = coalesce(pending_level, level),
         pending_level = null,
         produced_since = least(coalesce(produced_since, now()), now())
   where id = p_object_id;

  return v_cost;
end;
$$;

revoke execute on all functions in schema public from anon, authenticated;

grant execute on function public.place_object(text, integer, integer, integer) to authenticated;
grant execute on function public.move_object(uuid, integer, integer, integer) to authenticated;
grant execute on function public.remove_object(uuid) to authenticated;
grant execute on function public.collect_all() to authenticated;
grant execute on function public.upgrade_object(uuid) to authenticated;
grant execute on function public.rush_object(uuid) to authenticated;
grant execute on function public.sell_item(text, integer) to authenticated;
grant execute on function public.buy_item(text, integer) to authenticated;
grant execute on function public.object_stats(text, smallint) to authenticated;
grant execute on function public.storage_capacity(uuid, text) to authenticated;
grant execute on function public.stored_amount(uuid, text) to authenticated;
