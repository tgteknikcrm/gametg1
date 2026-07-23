-- =============================================================================
-- 0007 — İnşaat ve yıkımı para defterine bağla
--
-- 0003'teki iki fonksiyon aynen korunuyor; tek fark her para hareketinin
-- `ledger` tablosuna sebebiyle birlikte yazılması. Brief madde 4'teki
-- "para yaratımı ile yok oluşunu açıkça takip et" gereği bunu zorunlu kılıyor.
-- =============================================================================

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
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  -- Kural 5: doğrulamadan önce kilit. İki sekme aynı anda harcayamaz.
  select * into v_profile from public.profiles where id = v_user for update;
  if not found then
    raise exception 'profile_missing';
  end if;

  if p_rotation is null or p_rotation not in (0, 90, 180, 270) then
    raise exception 'invalid_rotation';
  end if;

  -- Kural 2: maliyet ve ölçü istemciden değil buradan.
  select * into v_type from public.object_types where id = p_type_id and is_active;
  if not found then
    raise exception 'unknown_type';
  end if;

  if v_profile.level < v_type.level_required then
    raise exception 'level_required';
  end if;

  if v_profile.coins < v_type.cost then
    raise exception 'insufficient_funds';
  end if;

  v_parcel := public.active_parcel(v_profile.city_id);
  if v_parcel.id is null then
    raise exception 'parcel_missing';
  end if;

  select w, h into v_w, v_h from public.rotated_footprint(v_type.width, v_type.height, p_rotation);

  if p_x < 0 or p_y < 0
     or p_x + v_w > v_parcel.width
     or p_y + v_h > v_parcel.height then
    raise exception 'out_of_bounds';
  end if;

  begin
    insert into public.placed_objects (
      parcel_id, owner_id, type_id, local_x, local_y, rotation,
      footprint_w, footprint_h, state, state_since
    ) values (
      v_parcel.id, v_user, v_type.id, p_x, p_y, p_rotation,
      v_w, v_h,
      case
        when v_type.build_seconds > 0 then 'building'::public.object_state
        else 'idle'::public.object_state
      end,
      now()
    )
    returning * into v_row;
  exception
    when exclusion_violation then
      raise exception 'cell_occupied';
  end;

  update public.profiles
     set coins = coins - v_type.cost,
         xp = xp + v_type.xp_reward
   where id = v_user;

  perform public.apply_level_up(v_user);
  perform public.record_ledger(v_user, 'build', -v_type.cost, v_type.id);

  return v_row;
end;
$$;

create or replace function public.remove_object(p_object_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_obj public.placed_objects;
  v_type public.object_types;
  v_refund bigint;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_obj from public.placed_objects where id = p_object_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  if v_obj.owner_id <> v_user then
    raise exception 'not_owner';
  end if;

  perform 1 from public.profiles where id = v_user for update;

  select * into v_type from public.object_types where id = v_obj.type_id;
  v_refund := floor(v_type.cost * v_type.refund_rate);

  delete from public.placed_objects where id = p_object_id;

  update public.profiles set coins = coins + v_refund where id = v_user;
  perform public.record_ledger(v_user, 'refund', v_refund, v_type.id);

  return v_refund;
end;
$$;

revoke all on function public.place_object(text, integer, integer, integer) from public;
revoke all on function public.remove_object(uuid) from public;
grant execute on function public.place_object(text, integer, integer, integer) to authenticated;
grant execute on function public.remove_object(uuid) to authenticated;
