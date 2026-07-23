-- =============================================================================
-- 0010 — Seviye eğrileri ve depo binaları
--
-- Seviye verisi elle yazılmıyor, formülle üretiliyor. Eğriyi değiştirmek için
-- bu dosyadaki çarpanları güncelleyip yeniden çalıştırmak yeterli — kod
-- dokunulmuyor (kural 6).
--
-- Eğriler:
--   üretim miktarı : her seviyede %28 artar
--   tur süresi     : her seviyede %4 kısalır, tabanı %45'te durur
--   yükseltme altını: her seviyede %65 artar
--   yükseltme süresi: her seviyede %55 artar
--   malzeme        : seviyeyle doğrusal artar, seviye 3'ten sonra taş da ister
-- =============================================================================

delete from public.object_level_costs;
delete from public.object_levels;

-- --- Depo binaları -----------------------------------------------------------

insert into public.items (id, name, npc_buy_price, npc_sell_price, npc_daily_consumption, color, sort_order)
values ('coal', 'Kömür', 12, 20, 0, '#4b5058', 80)
on conflict (id) do update set
  name = excluded.name, npc_buy_price = excluded.npc_buy_price,
  npc_sell_price = excluded.npc_sell_price, color = excluded.color, sort_order = excluded.sort_order;

update public.items set storage_class = 'goods' where id = 'coal';

insert into public.object_types (
  id, category, name, model_key, width, height, cost, build_seconds, produce_seconds,
  input_item_id, input_qty, output_item_id, output_qty,
  worker_slots, population_capacity, maintenance_per_hour, level_required,
  color, block_height, sort_order, storage_class, tier
) values
  ('granary',   'civic', 'Tahıl Ambarı', 'granary',   3, 3, 300, 120, null, null, null, null, null, 1, 0, 2, 1, '#c8a86b', 2.10, 5,  'grain', 0),
  ('warehouse', 'civic', 'Depo',         'warehouse', 3, 3, 300, 120, null, null, null, null, null, 1, 0, 2, 1, '#a9a29a', 2.10, 6,  'goods', 0),
  ('coal_mine', 'production', 'Kömür Ocağı', 'coal_mine', 3, 2, 640, 600, 1500, null, null, 'coal', 6, 4, 0, 7, 4, '#3f444c', 0.85, 55, null, 0)
on conflict (id) do update set
  category = excluded.category, name = excluded.name, width = excluded.width, height = excluded.height,
  cost = excluded.cost, build_seconds = excluded.build_seconds, produce_seconds = excluded.produce_seconds,
  output_item_id = excluded.output_item_id, output_qty = excluded.output_qty,
  worker_slots = excluded.worker_slots, maintenance_per_hour = excluded.maintenance_per_hour,
  level_required = excluded.level_required, color = excluded.color, block_height = excluded.block_height,
  sort_order = excluded.sort_order, storage_class = excluded.storage_class, tier = excluded.tier;

update public.object_types set tier = 0 where input_item_id is null;
update public.object_types set tier = 1 where input_item_id is not null;

-- Yükseltilebilir binalar: üretenler, depolar ve konutlar 20 seviyeye kadar.
update public.object_types set max_level = 20
 where produce_seconds is not null or storage_class is not null or population_capacity > 0;
update public.object_types set max_level = 1 where category = 'decor';

-- --- Seviye satırları --------------------------------------------------------

insert into public.object_levels (
  type_id, level, produce_seconds, output_qty, input_qty,
  storage_capacity, population_capacity, worker_slots, upgrade_coins, upgrade_seconds
)
select
  ot.id,
  lv::smallint,
  case when ot.produce_seconds is null then null
       else greatest(15, round(ot.produce_seconds * greatest(0.45, power(0.96, lv - 1))))::integer end,
  case when ot.output_qty is null then null
       else round(ot.output_qty * power(1.28, lv - 1))::integer end,
  case when ot.input_qty is null then null
       else round(ot.input_qty * power(1.22, lv - 1))::integer end,
  case when ot.storage_class is null then 0
       else round(400 * power(1.45, lv - 1))::integer end,
  case when ot.population_capacity = 0 then 0
       else round(ot.population_capacity * power(1.30, lv - 1))::integer end,
  round(ot.worker_slots * power(1.15, lv - 1))::smallint,
  case when lv = 1 then null
       else round(ot.cost * 0.85 * power(1.65, lv - 2))::bigint end,
  case when lv = 1 then null
       else greatest(30, round(greatest(ot.build_seconds, 60) * power(1.55, lv - 2)))::integer end
from public.object_types ot
cross join generate_series(1, 20) as lv
where lv <= ot.max_level;

-- --- Yükseltme malzemeleri ---------------------------------------------------
-- Seviye 2-3: kereste. 4+: kereste + taş. 8+: üstüne kömür.
-- Malzemeler oyuncuyu tek bir zincire değil, birden çok üretim koluna zorlar.

insert into public.object_level_costs (type_id, level, item_id, quantity)
select ol.type_id, ol.level, 'timber', greatest(4, round(6 * power(1.42, ol.level - 2))::integer)
  from public.object_levels ol
 where ol.level >= 2;

insert into public.object_level_costs (type_id, level, item_id, quantity)
select ol.type_id, ol.level, 'stone', greatest(3, round(4 * power(1.46, ol.level - 4))::integer)
  from public.object_levels ol
 where ol.level >= 4;

insert into public.object_level_costs (type_id, level, item_id, quantity)
select ol.type_id, ol.level, 'coal', greatest(2, round(3 * power(1.5, ol.level - 8))::integer)
  from public.object_levels ol
 where ol.level >= 8;

-- --- Mevcut binaların üretim penceresini başlat ------------------------------
-- Sürekli üretime geçiyoruz: `produced_since` yoksa şimdiden başlasın.

update public.placed_objects
   set produced_since = coalesce(produced_since, last_collected_at, state_since, now())
 where produced_since is null;
