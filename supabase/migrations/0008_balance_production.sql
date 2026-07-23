-- =============================================================================
-- 0008 — Üretim dengesi: süreler, fiyatlar, zincir
--
-- Bu dosyadaki her sayı çalışma zamanında `update` ile değiştirilebilir.
-- Süre birimi saniyedir; 5 saniyeden 1 güne kadar her ölçek kullanılıyor,
-- istenirse haftalık değerler de aynı kolona yazılabilir (arayüz biçimliyor).
--
-- Zincir mantığı: ham mal ucuz, işlenmiş mal pahalı. Böylece derinleşmek
-- kârlı olur ama her kademe bir öncekini beslemek zorunda kalır.
--   tarla → değirmen → fırın        (buğday → un → ekmek)
--   pamuk tarlası → tekstil atölyesi (pamuk → kumaş)
-- =============================================================================

-- --- Mallar: fiyat, renk, sıra ----------------------------------------------
-- npc_buy_price : oyuncu SATARKEN aldığı (gelir)
-- npc_sell_price: oyuncu ALIRKEN ödediği (gider) — aradaki fark para çıkışıdır

insert into public.items (id, name, npc_buy_price, npc_sell_price, npc_daily_consumption, color, sort_order) values
  ('wheat',  'Buğday',  1,  3,  0, '#d8b45c', 10),
  ('flour',  'Un',      6,  10, 0, '#e8e0cf', 20),
  ('bread',  'Ekmek',   20, 30, 12, '#b5763f', 30),
  ('cotton', 'Pamuk',   3,  6,  0, '#f2efe6', 40),
  ('cloth',  'Kumaş',   24, 38, 4, '#7b8fb5', 50),
  ('timber', 'Kereste', 4,  7,  0, '#8d6742', 60),
  ('stone',  'Taş',     9,  15, 0, '#9aa1a8', 70)
on conflict (id) do update set
  name = excluded.name,
  npc_buy_price = excluded.npc_buy_price,
  npc_sell_price = excluded.npc_sell_price,
  npc_daily_consumption = excluded.npc_daily_consumption,
  color = excluded.color,
  sort_order = excluded.sort_order;

-- --- Yeni bina: pamuk tarlası -----------------------------------------------
-- Tekstil zincirinin ilk halkası; olmadan pamuğu NPC'den almak gerekiyordu.

insert into public.object_types (
  id, category, name, model_key, width, height, cost, build_seconds, produce_seconds,
  input_item_id, input_qty, output_item_id, output_qty,
  worker_slots, population_capacity, maintenance_per_hour, level_required,
  color, block_height, sort_order
) values
  ('cotton_field', 'production', 'Pamuk Tarlası', 'cotton_field', 3, 3, 260, 45, 240,
   null, null, 'cotton', 10, 2, 0, 2, 3, '#e9e6dd', 0.22, 15)
on conflict (id) do update set
  name = excluded.name, width = excluded.width, height = excluded.height,
  cost = excluded.cost, output_item_id = excluded.output_item_id,
  output_qty = excluded.output_qty, color = excluded.color,
  block_height = excluded.block_height, sort_order = excluded.sort_order;

-- --- Süreler ve üretim zinciri ----------------------------------------------

update public.object_types set build_seconds = 20,    produce_seconds = 120,   input_item_id = null,     input_qty = null, output_item_id = 'wheat',  output_qty = 10 where id = 'wheat_field';
update public.object_types set build_seconds = 45,    produce_seconds = 240,   input_item_id = null,     input_qty = null, output_item_id = 'cotton', output_qty = 10 where id = 'cotton_field';
update public.object_types set build_seconds = 60,    produce_seconds = 300,   input_item_id = null,     input_qty = null, output_item_id = 'timber', output_qty = 8  where id = 'lumber_camp';
update public.object_types set build_seconds = 180,   produce_seconds = 240,   input_item_id = 'wheat',  input_qty = 8,    output_item_id = 'flour',  output_qty = 5  where id = 'mill';
update public.object_types set build_seconds = 300,   produce_seconds = 600,   input_item_id = 'flour',  input_qty = 5,    output_item_id = 'bread',  output_qty = 6  where id = 'bakery';
update public.object_types set build_seconds = 900,   produce_seconds = 1800,  input_item_id = null,     input_qty = null, output_item_id = 'stone',  output_qty = 6  where id = 'quarry';
update public.object_types set build_seconds = 1800,  produce_seconds = 3600,  input_item_id = 'cotton', input_qty = 6,    output_item_id = 'cloth',  output_qty = 4  where id = 'textile_workshop';

-- Üretmeyen yapılar: yalnızca inşa süresi.
update public.object_types set build_seconds = 60    where id = 'small_house';
update public.object_types set build_seconds = 300   where id = 'town_house';
update public.object_types set build_seconds = 1800  where id = 'villa';
update public.object_types set build_seconds = 7200  where id = 'apartment';   -- 2 saat
update public.object_types set build_seconds = 120   where id = 'market_square';
update public.object_types set build_seconds = 3600  where id = 'gym';          -- 1 saat
update public.object_types set build_seconds = 14400 where id = 'school';       -- 4 saat
update public.object_types set build_seconds = 86400 where id = 'town_hall';    -- 1 gün
update public.object_types set build_seconds = 5     where id in ('tree', 'bench');
update public.object_types set build_seconds = 10    where id = 'lamp_post';
update public.object_types set build_seconds = 60    where id = 'fountain';

-- --- Ödüller ----------------------------------------------------------------
-- İnşa XP'si maliyetten, hasat XP'si üretilen malın değerinden türetilir.

update public.object_types set xp_reward = greatest(1, round(cost / 10.0))::integer;

update public.object_types ot
   set harvest_xp = greatest(1, round(i.npc_buy_price * ot.output_qty / 3.0))::integer
  from public.items i
 where i.id = ot.output_item_id;

update public.object_types set harvest_xp = 0 where output_item_id is null;
