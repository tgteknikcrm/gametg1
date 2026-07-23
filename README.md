# Şehir Simülatörü

İzometrik, tarayıcı tabanlı, çok oyunculu şehir ekonomi simülatörü.
Oyuncular tek bir kalıcı şehri paylaşır; arsa alır, üretim binaları kurar,
NPC işçi çalıştırır, mal ticareti yapar.

**Durum: Faz 2 tamamlandı** — üretim döngüsü çalışıyor.
Bina kur → süre dolsun → üretime başla → hasat et → ambardan sat → para kazan.

## Çalıştırma

```bash
npm install
cp .env.example .env.local   # Supabase URL ve anon anahtarını gir
npm run dev                  # http://localhost:3000
```

`.env.local` içeriği (Supabase panelinde **Project Settings → API**):

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-anahtari>
```

Bu iki değer gizli değildir; tarayıcıya gider. Veriyi koruyan şey RLS ve
`SECURITY DEFINER` fonksiyonlardır. **`service_role` anahtarı asla kullanılmaz.**

## Veritabanı kurulumu

`supabase/migrations/` altındaki dosyaları sırayla Supabase panelindeki
**SQL Editor**'e yapıştırıp çalıştır:

| Dosya | İçerik |
|---|---|
| `0001_schema.sql` | Tablolar, enum'lar, çakışma engelleyen EXCLUDE kısıtı |
| `0002_rls.sql` | RLS açık, yalnızca `select` politikaları |
| `0003_functions.sql` | `place_object`, `move_object`, `remove_object`, kayıt tetikleyicisi |
| `0004_seed.sql` | Denge verisi: nesne türleri, seviye eşikleri, şehir, parsel |
| `0005_production.sql` | `effective_state`, `world_objects` görünümü, para defteri |
| `0006_production_rpcs.sql` | `start_production`, `harvest_object`, `harvest_all`, `sell_item`, `buy_item` |
| `0007_ledger_hooks.sql` | İnşaat ve yıkımı para defterine bağlar |
| `0008_balance_production.sql` | Süreler, mal fiyatları, üretim zinciri |

Prototip için Auth ayarlarından **e-posta onayını kapat** (Authentication →
Providers → Email → Confirm email = off). Üretimde açılmalı.

## Kontroller

| Girdi | Etki |
|-------|------|
| Sol tuş sürükle | Haritayı kaydır |
| Sağ tuş sürükle | Kamerayı yatayda döndür (izometrik eğim kilitli) |
| Tekerlek | Yakınlaş / uzaklaş |
| Sol tık (gezinme) | Nesne seç / seçimi bırak |
| Sol tık (yerleştirme) | İnşa et |
| `Q` / `E` | Hayaleti 90° döndür |
| `Esc` | Moddan çık, seçimi temizle |
| `Delete` | Seçili nesneyi kaldır — **onay penceresi açılır** |

## Üretim döngüsü

```
LAND ──▶ ÜRETİM ──▶ MAL ──▶ PAZAR ──▶ PARA ──▶ daha fazla bina
```

Bir bina yerleştirdiğinde `state = building`, `state_since = now()` yazılır.
**Hiçbir cron çalışmıyor** — güncel durum her okumada `now()` ile hesaplanır
(`effective_state`). İstemci sunucudan gelen `remaining_seconds`'ı alıp aradaki
saniyeleri kendisi sayar, sayaç bitince dünyayı tazeler.

| Durum | Anlamı | Nasıl çıkılır |
|---|---|---|
| `building` | İnşaat sürüyor | süre dolunca kendiliğinden `idle` |
| `idle` | Boşta | **Üretime başla** (varsa hammadde tüketilir) |
| `producing` | Üretim sürüyor | süre dolunca kendiliğinden `ready` |
| `ready` | Hasada hazır | **Hasat et** → mal ambara girer |

Zincir: buğday tarlası → değirmen (un) → fırın (ekmek) ·
pamuk tarlası → tekstil atölyesi (kumaş).
Ham mal ucuz, işlenmiş mal pahalı — derinleşmek kârlı.

Süreler saniye cinsinden `object_types` tablosunda; 5 saniyeden 1 güne kadar
değerler kullanılıyor. Arayüz saniye/dakika/saat/gün/hafta biçimlemesini
otomatik yapar, yani `604800` yazarsan "1h" gösterir.

### Para akışı takibi

Her altın hareketi `ledger` tablosuna sebebiyle kaydedilir (brief madde 4).
Ekonominin sağlığına tek sorguyla bakabilirsin:

```sql
select * from public.money_flow;
```

## Doğrulama

```bash
npm run typecheck        # TypeScript strict
npm run lint             # ESLint
npm run verify           # 58 kontrol: grid, rotasyon, çarpışma, hata eşlemesi,
                         #   süre biçimleme, üretim sayacı (veritabanı gerekmez)
npm run test:db          # 24 kontrol: RPC sözleşmesi, RLS, sahiplik, YARIŞ TESTİ
npm run test:production  # 31 kontrol: zaman, üretim, hasat, pazar, para defteri
npm run build            # üretim derlemesi
npm run gen:types        # şemadan TypeScript tipleri
```

`npm run test:db` yalnızca anon anahtarı kullanır.
`npm run test:production` ve `npm run gen:types` yönetim API'sine ihtiyaç duyar:

```powershell
$env:SUPABASE_ACCESS_TOKEN="sbp_..."; $env:SUPABASE_PROJECT_REF="<ref>"
```

### Yarış testi ne kanıtlıyor

8 eşzamanlı `place_object` çağrısı, aynı hücreye, aynı anda gönderilir.
**Tam olarak biri başarılı olur, oyuncu bir kez ücretlendirilir.** Bunu sağlayan
şey uygulama mantığı değil, `placed_objects` üzerindeki veritabanı kısıtı:

```sql
exclude using gist (parcel_id with =, footprint with &&)
```

## Mimari

**Tüm oyun mantığı PostgreSQL'de.** İstemci yalnızca `select` ve `rpc` çağırır;
hiçbir yerde `insert`/`update`/`delete` yok — RLS zaten izin vermiyor.
İstemci sadece tanımlayıcı gönderir (`type_id`, `x`, `y`, `rotation`); fiyat,
ayak izi, XP ödülü ve iade oranı sunucuda `object_types`'tan okunur.

```
src/
  app/                 Next.js App Router
  components/auth/     giriş kapısı ve form
  components/game/     R3F sahnesi (Canvas, kamera, zemin, hayalet, nesneler)
  components/ui-game/  HUD (üst bar, inşaat paneli, seçim künyesi, mod şeridi)
  components/ui/       shadcn/ui primitifleri
  hooks/               oturum, sorgu senkronu, mutasyonlar, klavye
  lib/                 grid matematiği, çarpışma, yerleştirme ön kontrolü, hata eşlemesi
  store/               Zustand: useGameStore (arayüz), useWorldStore (sunucu izdüşümü)
  types/               database.ts ÜRETİLMİŞTİR, elle düzenlenmez
supabase/migrations/   şema, RLS, fonksiyonlar, denge verisi
scripts/               doğrulama betikleri
```

### Durum akışı

```
PostgreSQL  ──select──▶  TanStack Query önbelleği  ──▶  useWorldStore (izdüşüm)  ──▶  R3F sahnesi
     ▲                            │
     └────────rpc()───────────────┘   iyimser güncelleme, hatada geri alma
```

`useWorldStore` kaynak değil aynadır: R3F'in render döngüsü `await` edemediği için
senkron okunabilir bir izdüşüm gerekiyor. Tek yazan `useWorldSync`.

## Ölçülen performans

Chrome + SwiftShader (yazılım rasterleyici), WebGL çizim çağrıları sayılarak:

| Sahne | Draw call |
|-------|-----------|
| Boş grid | 2 |
| **400 nesne** (grid tamamen dolu) | **3** |
| 400 nesne + aktif hayalet | 6 |

Tüm binalar tek `InstancedMesh` içinde; renk `instanceColor` ile örnek başına
veriliyor. Nesne sayısı draw call sayısını değiştirmiyor.

> 20×20 grid en fazla 400 hücre barındırdığı için brief'teki 500 nesne hedefinin
> üst sınırı bu fazda 400. Faz 3'te şehir gridi büyüyünce tavan da yükselecek.

## Fazlar

| Faz | Kapsam | Durum |
|-----|--------|-------|
| 0 | İstemci iskeleti, veritabanı yok | ✅ |
| 1 | Kalıcılık: Auth, şema, RPC'ler | ✅ |
| 2 | Üretim: zaman durum makinesi, hasat, envanter, NPC pazarı | ✅ |
| 3 | Arsa ve şehir: halka parselleri, mesafeye göre fiyat | sırada |
| 4 | İşgücü: nüfus, işçi ataması, ücretler | |
| 5 | Avatar: enerji, eğitim/kültür/spor | |
| 6 | Oyuncu ticareti: emir defteri | |
| 7 | Siyaset: partiler, seçimler, hazine, vergi | |

Tasarım kararları ve devreden geçici çözümler için [CLAUDE.md](CLAUDE.md).
