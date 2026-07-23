# Proje: İzometrik Şehir Ekonomi Simülatörü

Tarayıcı tabanlı, masaüstü, çok oyunculu şehir simülatörü. Oyuncular tek bir kalıcı
şehri paylaşır; arsa satın alır, üretim binaları kurar, NPC işçi çalıştırır, mal
ticareti yapar ve nihayetinde belediye siyaseti yürütür.

## İletişim dili

Kullanıcıyla **her zaman Türkçe** konuş. Açıklamalar, sorular, commit mesajları Türkçe.
Kod tanımlayıcıları, veritabanı kolonları ve dosya adları İngilizce. Kod yorumları Türkçe.

## Yığın (pazarlığa kapalı)

TypeScript (strict) · Next.js 15 App Router · Three.js + React Three Fiber + drei ·
Zustand · TanStack Query v5 · Supabase (PostgreSQL 15) · PL/pgSQL saklı yordamlar ·
Supabase Auth · Supabase Realtime (yalnızca bildirim) · Tailwind CSS + shadcn/ui ·
Vercel · Draco sıkıştırmalı GLB.

**Yeni bağımlılık eklemeden önce sor.**

## Mimari kurallar (pazarlığa kapalı)

1. **Tüm oyun mantığı PostgreSQL'de.** Her mutasyon (yerleştir, hasat et, al, sat, işe
   al, yükselt) bir `SECURITY DEFINER` PL/pgSQL fonksiyonudur. Oyun mantığı için
   Next.js API route yasak. İstemci yalnızca `supabase.rpc()` çağırır.
2. **İstemciye asla güvenme.** İstemci sadece tanımlayıcı gönderir (`object_id`,
   `type_id`, `x`, `y`, `quantity`). Fiyat, süre, verim ve maliyet her zaman sunucuda
   `object_types` / `items` tablolarından okunur.
3. **RLS var, yazma politikası yok.** Her yerde RLS açık. Yalnızca `SELECT` politikası
   yaz. `INSERT`/`UPDATE`/`DELETE` politikası yok.
4. **Tembel zaman değerlendirmesi.** Bina durumlarını ilerletmek için cron yok.
   `state_since TIMESTAMPTZ` sakla, güncel durumu okuma anında `now()` ile hesapla.
5. **Satır kilidi.** Her mutasyon fonksiyonu doğrulamadan önce `SELECT ... FOR UPDATE`
   ile başlar.
6. **Denge verisi veritabanında**, TypeScript'te değil. Ekonomi yeniden dengelemesi bir
   SQL `UPDATE` ile yapılabilmeli, yeniden dağıtım gerekmemeli.

## Kod standartları

- TypeScript strict, `any` yok
- Veritabanı tipleri Supabase şemasından üretilir, elle yazılmaz
- Oyun arayüz durumu için tek Zustand store: `mode`, `selectedObjectId`,
  `placingTypeId`, `ghostPosition`, `ghostRotation`, `ghostValid`
- İyimser güncellemeler TanStack Query ile, RPC hatasında geri alma
- Her RPC açıklayıcı exception fırlatır (`not_owner`, `not_ready`,
  `insufficient_funds`, `cell_occupied`); istemci bunları Türkçe mesaja çevirir
  (bkz. `src/lib/errors.ts`)
- Küçük, tek işe odaklı bileşenler; ~200 satırı geçen dosya yok

## Performans

Hedef donanım: tümleşik grafikli orta seviye dizüstü (Intel Iris Xe).

- Tekrar eden geometri için `InstancedMesh`
- Materyalleri agresif paylaş — sahnede ondan az farklı materyal
- Statik geometri için ışığı pişir; gerçek zamanlı gölge yalnızca hareketli nesnelere
- Frustum culling açık

## Fazlar

Sırayla ilerle, her fazın sonunda kullanıcının onayını bekle.

| Faz | Kapsam | Durum |
|-----|--------|-------|
| 0 | İstemci iskeleti, veritabanı yok | ✅ tamamlandı |
| 1 | Kalıcılık: Auth, şema, `place_object`/`move_object`/`remove_object` | ✅ tamamlandı |
| 2 | Üretim: zaman durum makinesi, hasat, envanter, NPC pazarı, XP | ✅ tamamlandı |
| 3 | Arsa ve şehir: halka parselleri, mesafe fiyatlaması, satın alma | sırada |
| 4 | İşgücü: nüfus havuzu, işçi ataması, ücretler | beklemede |
| 5 | Avatar gelişimi: enerji, eğitim/kültür/spor, istatistik bonusları | beklemede |
| 6 | Oyuncu ticareti: emir defteri; NPC fiyatları taban ve tavan | beklemede |
| 7 | Siyaset: partiler, seçimler, hazine, vergi oranları | beklemede |

## Veritabanı sözleşmesi (Faz 1)

RPC'ler `supabase/migrations/0003_functions.sql` içinde. Fırlattıkları exception
adları `src/lib/errors.ts`'teki `GameErrorCode` ile **birebir aynıdır** — yeni bir
hata kodu eklerken ikisini birlikte güncelle.

| RPC | İmza | Notlar |
|-----|------|--------|
| `place_object` | `(p_type_id text, p_x int, p_y int, p_rotation int)` | maliyet, ayak izi, XP sunucuda hesaplanır |
| `move_object` | `(p_object_id uuid, p_x int, p_y int, p_rotation int)` | ücretsiz, sahiplik kontrolü var |
| `remove_object` | `(p_object_id uuid) → bigint` | iade tutarını döner |
| `start_production` | `(p_object_id uuid)` | varsa hammaddeyi tüketir |
| `harvest_object` | `(p_object_id uuid) → (item_id, quantity, xp_gained)` | `not_ready` fırlatabilir |
| `harvest_all` | `() → (harvested, restarted, xp_gained, items)` | hepsini topla + yeniden başlat |
| `sell_item` / `buy_item` | `(p_item_id text, p_quantity int) → bigint` | fiyat `items` tablosundan |

## Zaman modeli (Faz 2)

Cron yok. `placed_objects` yalnızca `state` ve `state_since` tutar; gerçek durum
`effective_state(state, state_since, build_seconds, produce_seconds)` ile okuma
anında hesaplanır. İstemci `world_objects` görünümünden okur:

- `effective_state` — zaman uygulanmış durum
- `finishes_at` — mevcut aşamanın biteceği an
- `remaining_seconds` — **sunucuda** hesaplanmış kalan süre

İstemci aradaki saniyeleri `src/lib/production.ts` ile sayar; kullanıcının
sistem saati yanlış olsa bile geri sayım doğru olur çünkü mutlak zaman değil
kalan süre baz alınır. Sayaç sıfırlanınca `useProductionClock` dünyayı tazeler.

Çakışmayı uygulama değil veritabanı engeller:

```sql
exclude using gist (parcel_id with =, footprint with &&)
```

`footprint` üretilmiş bir `box` kolonudur, kenarlardan 0.1 içeri çekilmiştir
(bitişik binalar çakışıyor sayılmasın diye). Bu kısıt sayesinde iki sekmenin aynı
anda aynı hücreye inşa etmesi imkânsız — `npm run test:db` bunu 8 eşzamanlı
istekle sınıyor.

## Kalan geçici çözümler

- `GRID_SIZE` istemcide sabit 20. Sunucudaki parsel ölçüsüyle uyuşmazsa
  `useWorldSync` konsola uyarı basar. Faz 3'te parselden okunacak.
- Şehirde tek paylaşılan ring-0 parseli var; parsel sahipliği Faz 3'te gelecek.
- `maintenance_per_hour` kolonu dolu ama **henüz tahsil edilmiyor**. Faz 2'de
  ekonomiye tek para çıkışı NPC alış/satış makası; kalıcı giderler Faz 4'te
  (ücretler + bakım) gelecek. O zamana kadar altın birikmeye eğilimli.
- `worker_slots` gösteriliyor ama işçi ataması yok — Faz 4.
- Komşuların yeni binaları ancak yeniden çekimde görünür; Realtime bildirimleri
  Faz 4'te eklenecek.

## Komutlar

```bash
npm run dev        # geliştirme sunucusu
npm run build      # üretim derlemesi
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run verify     # grid/çarpışma matematiği (veritabanı gerekmez)
npm run test:db    # RPC sözleşmesi, RLS, sahiplik, yarış testi
npm run gen:types  # şemadan TypeScript tipleri
```

## Sır yönetimi

- `.env.local` ve `.env*` gitignore'da. Depoya asla anahtar girmez.
- İstemci yalnızca **anon** anahtarı kullanır; `service_role` hiçbir yerde geçmez.
- `SUPABASE_ACCESS_TOKEN` sadece `npm run gen:types` için, ortam değişkeninden okunur.
