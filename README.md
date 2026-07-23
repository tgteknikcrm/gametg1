# Şehir Simülatörü — Faz 0

İzometrik, tarayıcı tabanlı şehir ekonomi simülatörünün istemci iskeleti.
Bu fazda **veritabanı yok**: her şey bellekte, sayfa yenilenince sıfırlanır.

## Çalıştırma

```bash
npm install
npm run dev
# http://localhost:3000
```

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

## Elle test senaryosu

1. Sol panelden **Buğday Tarlası**'na tıkla → mod göstergesi "Yerleştirme" olur.
2. Grid üzerinde gez → 3×3 hayalet imlece **ortalanır**, yeşil görünür.
3. Tıkla → tarla kurulur, altın 5.000 → 4.880 düşer, XP artar.
4. Aynı yere tekrar gel → hayalet **kırmızı**, altta "Bu alan dolu" rozeti çıkar.
5. Grid kenarına git → "Grid dışına yerleştiremezsin".
6. **Taş Ocağı** (3×2) seç, `E`'ye bas → ayak izi 2×3'e döner, ön yüz çubuğu döner.
7. `Esc` → gezinme modu. Bir binaya tıkla → sağ altta künye paneli açılır,
   binanın çevresinde sarı tel kafes belirir.
8. **Taşı** → bina kaybolur, hayalet olarak imleci takip eder. Yeni yere tıkla.
9. Binayı seç, `Delete` → kaldırılır, maliyetin yarısı iade edilir.
10. **Kamu** sekmesindeki *Belediye Binası* (Sv 6) kilitli görünmeli — başlangıç
    seviyesi 3.

## Doğrulama

```bash
npm run typecheck   # TypeScript strict, hata yok
npm run lint        # ESLint
npm run verify      # 27 kontrol: grid dönüşümleri, rotasyon, çarpışma, ekonomi kapıları
npm run build       # üretim derlemesi
```

## Ölçülen performans

Chrome + SwiftShader (yazılım rasterleyici) üzerinde, WebGL çizim çağrıları sayılarak:

| Sahne | Draw call |
|-------|-----------|
| Boş grid | 2 |
| **400 nesne** (grid tamamen dolu) | **3** |
| 400 nesne + aktif hayalet | 6 |

Tüm binalar tek `InstancedMesh` içinde çizilir, renk `instanceColor` ile örnek başına
verilir. Nesne sayısı draw call sayısını değiştirmez.

> Not: Brief 500 nesne hedefliyor; 20×20 grid en fazla 400 hücre barındırdığı için üst
> sınır bu fazda 400. Faz 3'te şehir gridi büyüdüğünde tavan da yükselecek.

## Mimari notlar

```
src/
  app/                 Next.js App Router
  components/game/     R3F sahnesi (Canvas, kamera, zemin, hayalet, nesneler)
  components/ui-game/  HUD katmanı (üst bar, sidebar, seçim paneli, mod şeridi)
  components/ui/       shadcn/ui primitifleri
  hooks/               klavye, sürükleme-farkında tıklama, geliştirme köprüsü
  lib/                 grid matematiği, çarpışma, yerleştirme kuralları, katalog, three varlıkları
  store/               Zustand: useGameStore (arayüz), useWorldStore (dünya)
  types/               oyun tipleri
scripts/               matematik doğrulama betiği
```

Tasarım kararları ve Faz 1'e devreden geçici çözümler için [CLAUDE.md](CLAUDE.md).
