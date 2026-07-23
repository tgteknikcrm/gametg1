-- =============================================================================
-- 0003 — Oyun mantığı (SECURITY DEFINER)
--
-- Kural 1: her mutasyon burada. Kural 2: istemci yalnızca tanımlayıcı gönderir;
-- fiyat, ayak izi, ödül daima object_types'tan okunur. Kural 5: her mutasyon
-- doğrulamadan ÖNCE ilgili satırı FOR UPDATE ile kilitler.
--
-- Fırlatılan exception adları istemcideki src/lib/errors.ts ile birebir aynı.
-- =============================================================================

-- --- Yardımcılar (istemciye kapalı) -----------------------------------------

-- Rotasyon uygulanmış ayak izi. 90/270'te genişlik ve derinlik yer değiştirir.
create or replace function public.rotated_footprint(
  p_width smallint,
  p_height smallint,
  p_rotation integer,
  out w smallint,
  out h smallint
)
language plpgsql
immutable
as $$
begin
  if p_rotation in (90, 270) then
    w := p_height; h := p_width;
  else
    w := p_width;  h := p_height;
  end if;
end;
$$;

-- XP eşiği aşıldıkça seviye atlatır. Eşikler level_thresholds tablosunda.
create or replace function public.apply_level_up(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_level smallint;
  v_xp integer;
  v_need integer;
begin
  select level, xp into v_level, v_xp from public.profiles where id = p_user;

  loop
    select xp_required into v_need
      from public.level_thresholds where level = v_level + 1;
    exit when v_need is null or v_xp < v_need;
    v_level := v_level + 1;
    v_xp := v_xp - v_need;
  end loop;

  update public.profiles set level = v_level, xp = v_xp where id = p_user;
end;
$$;

-- Oyuncunun üzerine inşa edebileceği parsel. Faz 1'de şehir başına tek ring-0
-- parseli var; Faz 3'te sahiplik ve halka kontrolü buraya eklenecek.
create or replace function public.active_parcel(p_city uuid)
returns public.parcels
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from public.parcels where city_id = p_city and ring = 0 limit 1;
$$;

-- --- place_object ------------------------------------------------------------

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

  return v_row;
end;
$$;

-- --- move_object -------------------------------------------------------------
-- Faz 0'daki taşıma modunun kalıcı karşılığı. Taşıma ücretsizdir.

create or replace function public.move_object(
  p_object_id uuid,
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
  v_obj public.placed_objects;
  v_type public.object_types;
  v_parcel public.parcels;
  v_w smallint;
  v_h smallint;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  if p_rotation is null or p_rotation not in (0, 90, 180, 270) then
    raise exception 'invalid_rotation';
  end if;

  select * into v_obj from public.placed_objects where id = p_object_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  if v_obj.owner_id <> v_user then
    raise exception 'not_owner';
  end if;

  select * into v_type from public.object_types where id = v_obj.type_id;
  select * into v_parcel from public.parcels where id = v_obj.parcel_id;

  select w, h into v_w, v_h from public.rotated_footprint(v_type.width, v_type.height, p_rotation);

  if p_x < 0 or p_y < 0
     or p_x + v_w > v_parcel.width
     or p_y + v_h > v_parcel.height then
    raise exception 'out_of_bounds';
  end if;

  begin
    update public.placed_objects
       set local_x = p_x,
           local_y = p_y,
           rotation = p_rotation,
           footprint_w = v_w,
           footprint_h = v_h
     where id = p_object_id
     returning * into v_obj;
  exception
    when exclusion_violation then
      raise exception 'cell_occupied';
  end;

  return v_obj;
end;
$$;

-- --- remove_object -----------------------------------------------------------

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

  return v_refund;
end;
$$;

-- --- Yeni kullanıcı kurulumu -------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_city uuid;
  v_coins bigint;
  v_base text;
  v_username text;
  v_suffix integer := 0;
begin
  select id into v_city from public.cities order by created_at limit 1;
  select (value #>> '{}')::bigint into v_coins
    from public.game_config where key = 'starting_coins';

  v_base := coalesce(
    nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^a-zA-Z0-9_]', '', 'g'), ''),
    nullif(regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g'), ''),
    'oyuncu'
  );
  v_base := left(v_base, 18);
  if char_length(v_base) < 3 then
    v_base := v_base || 'xyz';
  end if;

  v_username := v_base;
  while exists (select 1 from public.profiles where username = v_username) loop
    v_suffix := v_suffix + 1;
    v_username := v_base || v_suffix::text;
  end loop;

  insert into public.profiles (id, username, city_id, coins)
  values (new.id, v_username, v_city, coalesce(v_coins, 5000));

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --- Yetkiler ----------------------------------------------------------------
-- Yalnızca oyuncu tarafından çağrılabilecek fonksiyonlar authenticated'a açık.

revoke all on function public.place_object(text, integer, integer, integer) from public;
revoke all on function public.move_object(uuid, integer, integer, integer) from public;
revoke all on function public.remove_object(uuid) from public;
revoke all on function public.apply_level_up(uuid) from public;
revoke all on function public.active_parcel(uuid) from public;
revoke all on function public.handle_new_user() from public;

grant execute on function public.place_object(text, integer, integer, integer) to authenticated;
grant execute on function public.move_object(uuid, integer, integer, integer) to authenticated;
grant execute on function public.remove_object(uuid) to authenticated;
