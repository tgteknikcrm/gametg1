-- =============================================================================
-- 0012 — Yeni kullanıcıya başlangıç elması
--
-- 0009 yalnızca MEVCUT profillere elmas verdi; kayıt tetikleyicisi
-- güncellenmediği için o tarihten sonra kaydolanlar 0 elmasla başlıyordu.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_city uuid;
  v_coins bigint;
  v_gems integer;
  v_base text;
  v_username text;
  v_suffix integer := 0;
begin
  select id into v_city from public.cities order by created_at limit 1;

  select (value #>> '{}')::bigint into v_coins
    from public.game_config where key = 'starting_coins';
  select (value #>> '{}')::integer into v_gems
    from public.game_config where key = 'starting_gems';

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

  insert into public.profiles (id, username, city_id, coins, gems)
  values (new.id, v_username, v_city, coalesce(v_coins, 5000), coalesce(v_gems, 1000));

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
