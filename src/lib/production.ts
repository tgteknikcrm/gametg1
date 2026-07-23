import type { ObjectState, WorldObject } from "@/types/game";

/**
 * Sunucu her nesne için anlık bir görüntü gönderir: `effective_state`,
 * `remaining_seconds` (inşaat/yükseltme için) ve `cycle_remaining_seconds` +
 * `pending_cycles` (sürekli üretim için).
 *
 * İstemci aradaki saniyeleri kendisi sayar ki geri sayım her sorgu turunda
 * zıplamasın. Sayım MUTLAK zamandan değil KALAN süreden yapılır: kullanıcının
 * sistem saati yanlış olsa bile doğru işler.
 */

/** `syncedAt` ve `now` milisaniye cinsindendir (aynı istemci saatinden). */
function elapsedSeconds(syncedAt: number, now: number): number {
  // Saat henüz ilk tik'ini atmadıysa geçen süreyi negatif saymayalım.
  return Math.max(0, (now - syncedAt) / 1000);
}

/** İnşaat / yükseltme için kalan süre. */
export function localRemainingSeconds(
  object: WorldObject,
  syncedAt: number,
  now: number,
): number {
  if (object.remaining_seconds === null) return 0;
  return Math.max(0, object.remaining_seconds - elapsedSeconds(syncedAt, now));
}

/** Geçen süreyi hesaba katarak durumu ilerletir. Artık yalnızca inşaat zamanlı. */
export function localState(
  object: WorldObject,
  syncedAt: number,
  now: number,
): ObjectState {
  const state = (object.effective_state ?? object.state) as ObjectState;
  if (state !== "building") return state;
  return localRemainingSeconds(object, syncedAt, now) > 0 ? "building" : "idle";
}

/** İnşaat/yükseltme ilerleme oranı 0–1. */
export function localProgress(
  object: WorldObject,
  totalSeconds: number,
  syncedAt: number,
  now: number,
): number {
  if (totalSeconds <= 0) return 1;
  const remaining = localRemainingSeconds(object, syncedAt, now);
  return Math.min(1, Math.max(0, 1 - remaining / totalSeconds));
}

// --- Sürekli üretim ---------------------------------------------------------

/** Bu bina üretim yapıyor mu (ve inşaatı bitmiş mi)? */
export function isProducing(object: WorldObject, syncedAt: number, now: number): boolean {
  return Boolean(object.cycle_seconds) && localState(object, syncedAt, now) === "idle";
}

/** Toplanmayı bekleyen tam tur sayısı — sunucunun verdiği sayı + yerel olarak dolanlar. */
export function localCycles(object: WorldObject, syncedAt: number, now: number): number {
  const cycle = object.cycle_seconds;
  if (!cycle) return 0;

  const base = object.pending_cycles ?? 0;
  const remaining = object.cycle_remaining_seconds ?? cycle;
  const elapsed = elapsedSeconds(syncedAt, now);

  if (elapsed < remaining) return base;
  return base + 1 + Math.floor((elapsed - remaining) / cycle);
}

/** Bekleyen mal miktarı. */
export function localPendingQty(object: WorldObject, syncedAt: number, now: number): number {
  return localCycles(object, syncedAt, now) * (object.cycle_output ?? 0);
}

/** Mevcut turun bitmesine kalan saniye. */
export function localCycleRemaining(
  object: WorldObject,
  syncedAt: number,
  now: number,
): number {
  const cycle = object.cycle_seconds;
  if (!cycle) return 0;

  const remaining = object.cycle_remaining_seconds ?? cycle;
  const elapsed = elapsedSeconds(syncedAt, now);

  if (elapsed < remaining) return remaining - elapsed;
  return cycle - ((elapsed - remaining) % cycle);
}

/** Mevcut turun ilerleme oranı 0–1 — bina üstündeki çubuk için. */
export function localCycleProgress(
  object: WorldObject,
  syncedAt: number,
  now: number,
): number {
  const cycle = object.cycle_seconds;
  if (!cycle) return 0;
  return Math.min(1, Math.max(0, 1 - localCycleRemaining(object, syncedAt, now) / cycle));
}

/**
 * Sunucudaki bilgi bayat mı?
 *
 * İki durumda tazeleme gerekir: inşaat/yükseltme bitti ama sunucu hâlâ
 * "building" diyor, ya da yerel sayaçta yeni bir üretim turu doldu.
 */
export function isStale(object: WorldObject, syncedAt: number, now: number): boolean {
  const server = (object.effective_state ?? object.state) as ObjectState;
  if (server === "building" && localRemainingSeconds(object, syncedAt, now) <= 0) return true;
  return localCycles(object, syncedAt, now) > (object.pending_cycles ?? 0);
}
