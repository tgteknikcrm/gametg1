-- =============================================================================
-- 0006 — Üretim ve NPC pazarı fonksiyonları
--
-- Zaman kontrolü daima sunucuda: istemci "hazır" dese bile `effective_state`
-- kabul etmezse işlem `not_ready` ile reddedilir.
-- =============================================================================

-- --- Üretime başla ----------------------------------------------------------

create or replace function public.start_production(p_object_id uuid)
returns public.placed_objects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_obj public.placed_objects;
  v_type public.object_types;
  v_state public.object_state;
  v_have integer;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_obj from public.placed_objects where id = p_object_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_obj.owner_id <> v_user then raise exception 'not_owner'; end if;

  select * into v_type from public.object_types where id = v_obj.type_id;
  if v_type.produce_seconds is null then raise exception 'not_producible'; end if;

  v_state := public.effective_state(v_obj.state, v_obj.state_since, v_type.build_seconds, v_type.produce_seconds);

  if v_state = 'building' then raise exception 'still_building'; end if;
  if v_state = 'producing' then raise exception 'already_producing'; end if;
  if v_state = 'ready' then raise exception 'harvest_first'; end if;

  -- Girdi gerektiren binalar önce hammaddeyi tüketir.
  if v_type.input_item_id is not null then
    select quantity into v_have
      from public.inventory
     where user_id = v_user and item_id = v_type.input_item_id
     for update;

    if coalesce(v_have, 0) < v_type.input_qty then
      raise exception 'missing_input';
    end if;

    update public.inventory
       set quantity = quantity - v_type.input_qty
     where user_id = v_user and item_id = v_type.input_item_id;
  end if;

  update public.placed_objects
     set state = 'producing', state_since = now()
   where id = p_object_id
   returning * into v_obj;

  return v_obj;
end;
$$;

-- --- Hasat ------------------------------------------------------------------

create or replace function public.harvest_object(p_object_id uuid)
returns table (item_id text, quantity integer, xp_gained integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_obj public.placed_objects;
  v_type public.object_types;
  v_state public.object_state;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select * into v_obj from public.placed_objects where id = p_object_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_obj.owner_id <> v_user then raise exception 'not_owner'; end if;

  select * into v_type from public.object_types where id = v_obj.type_id;

  v_state := public.effective_state(v_obj.state, v_obj.state_since, v_type.build_seconds, v_type.produce_seconds);
  if v_state <> 'ready' then raise exception 'not_ready'; end if;

  perform public.add_to_inventory(v_user, v_type.output_item_id, v_type.output_qty);

  perform 1 from public.profiles where id = v_user for update;
  update public.profiles set xp = xp + v_type.harvest_xp where id = v_user;
  perform public.apply_level_up(v_user);

  update public.placed_objects
     set state = 'idle', state_since = now(), last_collected_at = now()
   where id = p_object_id;

  return query select v_type.output_item_id, v_type.output_qty, v_type.harvest_xp;
end;
$$;

-- --- Toplu hasat -------------------------------------------------------------
-- Önce hazır olan her şeyi toplar, sonra girdisi yeten her binayı tekrar başlatır.
-- Sıra önemli: hasat envanteri doldurur, yeniden başlatma o envanteri harcar.

create or replace function public.harvest_all()
returns table (harvested integer, restarted integer, xp_gained integer, items jsonb)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_row record;
  v_harvested integer := 0;
  v_restarted integer := 0;
  v_xp integer := 0;
  v_items jsonb := '{}'::jsonb;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  for v_row in
    select po.id, ot.output_item_id, ot.output_qty, ot.harvest_xp
      from public.placed_objects po
      join public.object_types ot on ot.id = po.type_id
     where po.owner_id = v_user
       and public.effective_state(po.state, po.state_since, ot.build_seconds, ot.produce_seconds) = 'ready'
     for update of po
  loop
    perform public.add_to_inventory(v_user, v_row.output_item_id, v_row.output_qty);
    update public.placed_objects
       set state = 'idle', state_since = now(), last_collected_at = now()
     where id = v_row.id;

    v_harvested := v_harvested + 1;
    v_xp := v_xp + v_row.harvest_xp;
    v_items := jsonb_set(
      v_items,
      array[v_row.output_item_id],
      to_jsonb(coalesce((v_items ->> v_row.output_item_id)::integer, 0) + v_row.output_qty)
    );
  end loop;

  if v_xp > 0 then
    perform 1 from public.profiles where id = v_user for update;
    update public.profiles set xp = xp + v_xp where id = v_user;
    perform public.apply_level_up(v_user);
  end if;

  -- Boşta duran ve girdisi yeten üretim binalarını yeniden başlat.
  for v_row in
    select po.id
      from public.placed_objects po
      join public.object_types ot on ot.id = po.type_id
     where po.owner_id = v_user
       and ot.produce_seconds is not null
       and public.effective_state(po.state, po.state_since, ot.build_seconds, ot.produce_seconds) = 'idle'
  loop
    begin
      perform public.start_production(v_row.id);
      v_restarted := v_restarted + 1;
    exception
      -- Girdisi yetmeyeni sessizce atla; toplu işlem yarıda kalmasın.
      when others then null;
    end;
  end loop;

  return query select v_harvested, v_restarted, v_xp, v_items;
end;
$$;

-- --- NPC pazarı --------------------------------------------------------------

create or replace function public.sell_item(p_item_id text, p_quantity integer)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
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

  -- Kural 2: fiyat istemciden değil `items` tablosundan.
  v_total := p_quantity::bigint * v_item.npc_buy_price;

  update public.inventory set quantity = quantity - p_quantity
   where user_id = v_user and item_id = p_item_id;

  update public.profiles set coins = coins + v_total where id = v_user;
  perform public.record_ledger(v_user, 'npc_sale', v_total, p_item_id || ' x' || p_quantity);

  return v_total;
end;
$$;

create or replace function public.buy_item(p_item_id text, p_quantity integer)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
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
  perform public.add_to_inventory(v_user, p_item_id, p_quantity);
  perform public.record_ledger(v_user, 'npc_purchase', -v_total, p_item_id || ' x' || p_quantity);

  return v_total;
end;
$$;

-- --- Yetkiler ----------------------------------------------------------------

revoke all on function public.start_production(uuid) from public;
revoke all on function public.harvest_object(uuid) from public;
revoke all on function public.harvest_all() from public;
revoke all on function public.sell_item(text, integer) from public;
revoke all on function public.buy_item(text, integer) from public;
revoke all on function public.effective_state(public.object_state, timestamptz, integer, integer) from public;
revoke all on function public.finishes_at(public.object_state, timestamptz, integer, integer) from public;

grant execute on function public.start_production(uuid) to authenticated;
grant execute on function public.harvest_object(uuid) to authenticated;
grant execute on function public.harvest_all() to authenticated;
grant execute on function public.sell_item(text, integer) to authenticated;
grant execute on function public.buy_item(text, integer) to authenticated;
-- Görünüm bu iki fonksiyonu çağırıyor; okuma yetkisi için gerekli.
grant execute on function public.effective_state(public.object_state, timestamptz, integer, integer) to authenticated;
grant execute on function public.finishes_at(public.object_state, timestamptz, integer, integer) to authenticated;
