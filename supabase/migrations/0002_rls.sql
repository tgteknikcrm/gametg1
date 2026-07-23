-- =============================================================================
-- 0002 — Row Level Security
--
-- Kural 3: her yerde RLS açık, YALNIZCA select politikası var.
-- insert / update / delete politikası bilerek yazılmadı — tüm mutasyonlar
-- SECURITY DEFINER fonksiyonlardan geçer. Bir tabloya doğrudan yazma denemesi,
-- rol ne olursa olsun, politika bulunamadığı için reddedilir.
-- =============================================================================

alter table public.game_config enable row level security;
alter table public.level_thresholds enable row level security;
alter table public.items enable row level security;
alter table public.object_types enable row level security;
alter table public.cities enable row level security;
alter table public.profiles enable row level security;
alter table public.parcels enable row level security;
alter table public.placed_objects enable row level security;
alter table public.inventory enable row level security;
alter table public.market_orders enable row level security;

-- --- Katalog ve denge verisi: herkese açık okuma -----------------------------
-- Giriş yapmamış ziyaretçi de inşaat menüsünü görebilsin diye anon da dahil.

create policy game_config_read on public.game_config
  for select to anon, authenticated using (true);

create policy level_thresholds_read on public.level_thresholds
  for select to anon, authenticated using (true);

create policy items_read on public.items
  for select to anon, authenticated using (true);

create policy object_types_read on public.object_types
  for select to anon, authenticated using (true);

-- --- Şehir verisi: giriş yapmış herkes okuyabilir ---------------------------
-- Tek şehir paylaşıldığı için komşuların binalarını görmek gerekli.

create policy cities_read on public.cities
  for select to authenticated using (true);

create policy parcels_read on public.parcels
  for select to authenticated using (true);

create policy placed_objects_read on public.placed_objects
  for select to authenticated using (true);

create policy market_orders_read on public.market_orders
  for select to authenticated using (true);

-- --- Profil: herkes görünür (komşu adları için), hassas alan yok ------------

create policy profiles_read on public.profiles
  for select to authenticated using (true);

-- --- Envanter: yalnızca kendi satırların ------------------------------------

create policy inventory_read_own on public.inventory
  for select to authenticated using (user_id = (select auth.uid()));
