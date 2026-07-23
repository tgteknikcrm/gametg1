-- =============================================================================
-- 0004 — Denge verisi
--
-- Kural 6: bu dosyadaki her sayı çalışma zamanında SQL UPDATE ile değiştirilebilir.
-- Ekonomiyi yeniden dengelemek için yeniden dağıtım gerekmez.
-- Tekrar çalıştırılabilir (idempotent).
-- =============================================================================

-- --- Genel ayarlar ----------------------------------------------------------

insert into public.game_config (key, value, description) values
  ('starting_coins',       '5000',  'Yeni oyuncunun başlangıç altını'),
  ('starting_energy',      '60',    'Yeni oyuncunun başlangıç enerjisi'),
  ('energy_max',           '60',    'Enerji üst sınırı'),
  ('energy_regen_seconds', '300',   'Bir enerji biriminin yenilenme süresi'),
  ('parcel_size',          '20',    'Faz 1 paylaşılan parselinin kenar uzunluğu'),
  ('city_name',            '"Yeni Şehir"', 'Başlangıç şehrinin adı')
on conflict (key) do update
  set value = excluded.value, description = excluded.description;

-- --- Seviye eşikleri --------------------------------------------------------
-- Seviye N'e çıkmak için gereken XP. Her seviyede %60 büyür.

insert into public.level_thresholds (level, xp_required)
select lvl::smallint, round(100 * power(1.6, lvl - 2))::integer
  from generate_series(2, 30) as lvl
on conflict (level) do update set xp_required = excluded.xp_required;

-- --- Mallar -----------------------------------------------------------------

insert into public.items (id, name, npc_buy_price, npc_sell_price, npc_daily_consumption) values
  ('wheat',  'Buğday', 4,  7,  0),
  ('flour',  'Un',     11, 17, 0),
  ('bread',  'Ekmek',  26, 38, 12),
  ('timber', 'Kereste', 9, 14, 0),
  ('stone',  'Taş',    14, 21, 0),
  ('cotton', 'Pamuk',  8,  13, 0),
  ('cloth',  'Kumaş',  31, 46, 4)
on conflict (id) do update set
  name = excluded.name,
  npc_buy_price = excluded.npc_buy_price,
  npc_sell_price = excluded.npc_sell_price,
  npc_daily_consumption = excluded.npc_daily_consumption;

-- --- Nesne türleri ----------------------------------------------------------

insert into public.object_types (
  id, category, name, model_key, width, height, cost, build_seconds, produce_seconds,
  input_item_id, input_qty, output_item_id, output_qty,
  worker_slots, population_capacity, maintenance_per_hour, level_required,
  color, block_height, sort_order
) values
  -- Üretim
  ('wheat_field',      'production', 'Buğday Tarlası',   'wheat_field',      3, 3,  120,  30, 300, null,    null, 'wheat',  12, 2, 0,  1, 1, '#d8b45c', 0.20, 10),
  ('lumber_camp',      'production', 'Kereste Kampı',    'lumber_camp',      2, 3,  300,  60, 360, null,    null, 'timber',  8, 3, 0,  3, 1, '#8d6742', 1.00, 20),
  ('mill',             'production', 'Değirmen',         'mill',             2, 2,  380,  75, 300, 'wheat',    6, 'flour',   4, 2, 0,  4, 2, '#cbb89a', 2.10, 30),
  ('bakery',           'production', 'Fırın',            'bakery',           2, 2,  450,  90, 420, 'flour',    4, 'bread',   6, 3, 0,  5, 2, '#c9764a', 1.40, 40),
  ('quarry',           'production', 'Taş Ocağı',        'quarry',           3, 2,  520, 120, 600, null,    null, 'stone',   6, 4, 0,  6, 3, '#9aa1a8', 0.80, 50),
  ('textile_workshop', 'production', 'Tekstil Atölyesi', 'textile_workshop', 3, 2,  700, 150, 540, 'cotton',   5, 'cloth',   4, 4, 0,  8, 3, '#7b8fb5', 1.50, 60),

  -- Konut
  ('small_house', 'housing', 'Küçük Ev', 'small_house', 2, 2, 200,  45, null, null, null, null, null, 0,  4,  2, 1, '#e0c9a6', 1.20, 10),
  ('town_house',  'housing', 'Sıra Ev',  'town_house',  2, 3, 420,  80, null, null, null, null, null, 0,  9,  4, 2, '#d98f7a', 1.70, 20),
  ('villa',       'housing', 'Villa',    'villa',       3, 2, 780, 140, null, null, null, null, null, 0,  6,  9, 3, '#f0e2c0', 1.90, 30),
  ('apartment',   'housing', 'Apartman', 'apartment',   3, 3, 950, 180, null, null, null, null, null, 0, 24, 12, 4, '#b3c2d1', 3.20, 40),

  -- Kamu
  ('market_square', 'civic', 'Pazar Yeri',      'market_square',  3, 2,  350,  60, null, null, null, null, null, 2, 0,  3, 1, '#c2a06b', 0.50, 10),
  ('gym',           'civic', 'Spor Salonu',     'gym',            3, 3, 1100, 200, null, null, null, null, null, 3, 0, 10, 4, '#8fb0a3', 2.00, 20),
  ('school',        'civic', 'Okul',            'school',         4, 3, 1400, 240, null, null, null, null, null, 5, 0, 14, 5, '#e8e3d3', 2.30, 30),
  ('town_hall',     'civic', 'Belediye Binası', 'town_hall',      4, 4, 2500, 300, null, null, null, null, null, 6, 0, 20, 6, '#d5d0c4', 3.60, 40),

  -- Süsleme
  ('tree',      'decor', 'Ağaç',           'tree',      1, 1, 20,  2, null, null, null, null, null, 0, 0, 0, 1, '#4f7f43', 1.10, 10),
  ('bench',     'decor', 'Bank',           'bench',     1, 1, 15,  3, null, null, null, null, null, 0, 0, 0, 1, '#8a6b4f', 0.35, 20),
  ('lamp_post', 'decor', 'Sokak Lambası',  'lamp_post', 1, 1, 35,  5, null, null, null, null, null, 0, 0, 1, 1, '#5c5f66', 1.70, 30),
  ('fountain',  'decor', 'Çeşme',          'fountain',  1, 1, 90, 15, null, null, null, null, null, 0, 0, 1, 2, '#a8c4d4', 0.60, 40)
on conflict (id) do update set
  category = excluded.category, name = excluded.name, model_key = excluded.model_key,
  width = excluded.width, height = excluded.height, cost = excluded.cost,
  build_seconds = excluded.build_seconds, produce_seconds = excluded.produce_seconds,
  input_item_id = excluded.input_item_id, input_qty = excluded.input_qty,
  output_item_id = excluded.output_item_id, output_qty = excluded.output_qty,
  worker_slots = excluded.worker_slots, population_capacity = excluded.population_capacity,
  maintenance_per_hour = excluded.maintenance_per_hour, level_required = excluded.level_required,
  color = excluded.color, block_height = excluded.block_height, sort_order = excluded.sort_order;

-- XP ödülü maliyetten türetilir; ayrı ayrı elle yazmaya gerek yok.
update public.object_types set xp_reward = greatest(1, round(cost / 10.0))::integer;

-- --- Başlangıç şehri ve paylaşılan parsel -----------------------------------

insert into public.cities (name, center_x, center_y, active_rings)
select (value #>> '{}'), 0, 0, 1
  from public.game_config where key = 'city_name'
   and not exists (select 1 from public.cities);

-- Faz 1: tek paylaşılan ring-0 parseli, Faz 0'daki 20x20 grid ile aynı ölçüde.
insert into public.parcels (city_id, ring, x, y, width, height, base_price)
select c.id, 0, 0, 0,
       (g.value #>> '{}')::smallint,
       (g.value #>> '{}')::smallint,
       0
  from public.cities c
  cross join public.game_config g
 where g.key = 'parcel_size'
   and not exists (select 1 from public.parcels p where p.city_id = c.id and p.ring = 0);
