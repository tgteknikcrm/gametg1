# Şehir Simülatörü

İzometrik, tarayıcı tabanlı, çok oyunculu şehir ekonomi simülatörü.
Oyuncular tek bir kalıcı şehri paylaşır; arsa alır, üretim binaları kurar,
NPC işçi çalıştırır, mal ticareti yapar.

**Durum: Faz 1 tamamlandı** — kalıcılık çalışıyor. Sayfayı yenilediğinde şehrin yerinde.

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
| `0004_seed.sql` | Denge verisi: 18 nesne türü, seviye eşikleri, şehir, parsel |

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
| `Delete` | Seçili nesneyi kaldır (maliyetin %50'si iade) |

## Doğrulama

```bash
npm run typecheck   # TypeScript strict
npm run lint        # ESLint
npm run verify      # 27 kontrol: grid matematiği, rotasyon, çarpışma (DB gerekmez)
npm run test:db     # 24 kontrol: RPC sözleşmesi, RLS, sahiplik, YARIŞ TESTİ
npm run build       # üretim derlemesi
npm run gen:types   # şemadan TypeScript tipleri (SUPABASE_ACCESS_TOKEN gerekir)
```

`npm run test:db` gerçek kullanıcı kaydı açar, gerçek RPC çağırır ve kendi
oluşturduğu nesneleri temizler. Yalnızca anon anahtarı kullanır.

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
| 2 | Üretim: zaman durum makinesi, hasat, envanter, NPC pazarı | sırada |
| 3 | Arsa ve şehir: halka parselleri, mesafeye göre fiyat | |
| 4 | İşgücü: nüfus, işçi ataması, ücretler | |
| 5 | Avatar: enerji, eğitim/kültür/spor | |
| 6 | Oyuncu ticareti: emir defteri | |
| 7 | Siyaset: partiler, seçimler, hazine, vergi | |

Tasarım kararları ve devreden geçici çözümler için [CLAUDE.md](CLAUDE.md).
