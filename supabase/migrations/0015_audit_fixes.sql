-- =============================================================================
-- 0015 — Denetim bulguları: ekonomi ve gizlilik
--
-- 1. `items_price_spread` kısıtındaki kaçak: `or npc_sell_price = 0` koşulu,
--    satış fiyatı 0 iken alış fiyatının istenildiği kadar yüksek olmasına izin
--    veriyordu — kısıtın engellemek için var olduğu durumun ta kendisi.
-- 2. `place_object` XP veriyor ama `remove_object` geri almıyordu: kur-yık
--    döngüsüyle altın XP'ye çevrilip seviye kapıları aşılabiliyordu.
-- 3. `profiles` satırının tamamı tüm oyunculara açıktı (altın, elmas, XP,
--    enerji, e-postadan türetilmiş kullanıcı adı). İstemci zaten yalnızca kendi
--    profilini okuyor; komşu adı için ayrı ve dar bir görünüm var.
-- =============================================================================

-- --- 1. Fiyat makası kaçağını kapat -----------------------------------------

alter table public.items drop constraint if exists items_price_spread;

update public.items
   set npc_sell_price = greatest(npc_sell_price, npc_buy_price + 1)
 where npc_buy_price > 0 and npc_sell_price <= npc_buy_price;

-- Artık istisna yok: NPC her zaman aldığından pahalıya satar.
-- Bedava mallar (alış 0) için satış da 0 olabilir.
alter table public.items
  add constraint items_price_spread
  check (
    (npc_buy_price = 0 and npc_sell_price = 0)
    or npc_sell_price > npc_buy_price
  );

-- --- 2. Yıkım verilen XP'yi geri alsın --------------------------------------
-- Kur-yık döngüsünün XP kazancı artık net sıfır; altın kaybı ise duruyor.

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

  update public.profiles
     set coins = coins + v_refund,
         -- İnşa ederken verilen XP geri alınır; aksi hâlde altın XP'ye çevrilip
         -- seviye kapıları satın alınabiliyordu.
         xp = greatest(0, xp - v_type.xp_reward)
   where id = v_user;

  perform internal.record_ledger(v_user, 'refund', v_refund, v_type.id);

  return v_refund;
end;
$$;

-- --- 3. Profil gizliliği ----------------------------------------------------
-- Oyuncu yalnızca kendi profilini okur. Komşu adı/seviyesi için dar görünüm.

drop policy if exists profiles_read on public.profiles;

create policy profiles_read_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create or replace view public.public_profiles
with (security_invoker = on)
as
select id, username, level
  from public.profiles;

grant select on public.public_profiles to authenticated;

-- Görünüm `security_invoker` olduğu için altındaki RLS uygulanır ve tek başına
-- hiçbir şey göstermez. Komşu adlarını göstermek gerektiğinde (Faz 3) buraya
-- ayrı bir politika eklenecek; şimdilik istemci başkasının profilini okumuyor.

-- --- 4. Yetkileri tekrar sabitle --------------------------------------------

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
