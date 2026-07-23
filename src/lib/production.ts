import type { ObjectState, WorldObject } from "@/types/game";

/**
 * Sunucu her nesne için `effective_state` ve `remaining_seconds` gönderir.
 * Bunlar bir ANLIK GÖRÜNTÜdür; istemci aradaki saniyeleri kendisi sayar ki
 * geri sayım her sorgu turunda zıplamasın.
 *
 * Sayım sunucunun verdiği kalan süreden yapılır, mutlak bir zaman damgasından
 * değil: kullanıcının sistem saati yanlış olsa bile geri sayım doğru işler.
 */

/** `syncedAt` ve `now` milisaniye cinsindendir (aynı istemci saatinden). */
export function localRemainingSeconds(
  object: WorldObject,
  syncedAt: number,
  now: number,
): number {
  if (object.remaining_seconds === null) return 0;
  // Saat henüz ilk tik'ini atmadıysa geçen süreyi negatif saymayalım.
  const elapsed = Math.max(0, (now - syncedAt) / 1000);
  return Math.max(0, object.remaining_seconds - elapsed);
}

/** Geçen süreyi hesaba katarak durumu ilerletir. */
export function localState(
  object: WorldObject,
  syncedAt: number,
  now: number,
): ObjectState {
  const state = object.effective_state ?? object.state;
  if (state !== "building" && state !== "producing") return state as ObjectState;
  if (localRemainingSeconds(object, syncedAt, now) > 0) return state as ObjectState;
  return state === "building" ? "idle" : "ready";
}

/** İlerleme oranı 0–1; ilerleme çubuğu için. */
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

/**
 * Sunucudaki durum bayat mı? Yerel sayaç bitti ama sunucu hâlâ "üretiyor"
 * diyorsa, dünyayı yeniden çekmenin tam zamanıdır.
 */
export function isStale(object: WorldObject, syncedAt: number, now: number): boolean {
  const server = object.effective_state ?? object.state;
  if (server !== "building" && server !== "producing") return false;
  return localRemainingSeconds(object, syncedAt, now) <= 0;
}
