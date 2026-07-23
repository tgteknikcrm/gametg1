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
| 1 | Kalıcılık: Auth, şema, `place_object`/`remove_object` RPC'leri | beklemede |
| 2 | Üretim: zaman durum makinesi, hasat, envanter, NPC pazarı, XP | beklemede |
| 3 | Arsa ve şehir: halka parselleri, mesafe fiyatlaması, satın alma | beklemede |
| 4 | İşgücü: nüfus havuzu, işçi ataması, ücretler | beklemede |
| 5 | Avatar gelişimi: enerji, eğitim/kültür/spor, istatistik bonusları | beklemede |
| 6 | Oyuncu ticareti: emir defteri; NPC fiyatları taban ve tavan | beklemede |
| 7 | Siyaset: partiler, seçimler, hazine, vergi oranları | beklemede |

## Faz 0'dan devralınan geçici çözümler

Bunlar Faz 1'de kaldırılacak, dosyaların başında da not edildi:

- `src/lib/catalog.ts` — `object_types` tablosunun elle yazılmış aynası
- `src/store/useWorldStore.ts` — sunucu durumunun bellek içi yerine geçeni
- `src/lib/placement.ts` — istemci tarafı doğrulama; sunucuda tekrarlanacak
- `src/types/game.ts` — `supabase gen types` çıktısıyla değiştirilecek

## Komutlar

```bash
npm run dev        # geliştirme sunucusu
npm run build      # üretim derlemesi
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run verify     # grid/çarpışma matematiği doğrulaması
```
