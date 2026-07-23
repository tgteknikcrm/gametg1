import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Oyun hata kodları.
 *
 * Bu adlar `supabase/migrations/0003_functions.sql` içindeki
 * `raise exception '<kod>'` ifadeleriyle BİREBİR aynıdır. Sunucu kodu fırlatır,
 * istemci burada Türkçeye çevirir. Tek bir yerde tutulmasının sebebi bu.
 */
export type GameErrorCode =
  | "out_of_bounds"
  | "cell_occupied"
  | "insufficient_funds"
  | "level_required"
  | "not_owner"
  | "not_ready"
  | "not_found"
  | "not_authenticated"
  | "unknown_type"
  | "invalid_rotation"
  | "profile_missing"
  | "parcel_missing"
  | "no_selection"
  | "network"
  | "unknown";

const MESSAGES: Record<GameErrorCode, string> = {
  out_of_bounds: "Grid dışına yerleştiremezsin",
  cell_occupied: "Bu alan dolu",
  insufficient_funds: "Yeterli altının yok",
  level_required: "Seviyen yetersiz",
  not_owner: "Bu nesne sana ait değil",
  not_ready: "Henüz hazır değil",
  not_found: "Nesne bulunamadı",
  not_authenticated: "Oturumun kapanmış, tekrar giriş yap",
  unknown_type: "Bilinmeyen yapı türü",
  invalid_rotation: "Geçersiz yön",
  profile_missing: "Profilin bulunamadı",
  parcel_missing: "Şehirde uygun arsa yok",
  no_selection: "Önce bir nesne seç",
  network: "Sunucuya ulaşılamadı",
  unknown: "Beklenmeyen bir hata oldu",
};

const KNOWN_CODES = new Set(Object.keys(MESSAGES));

/** Hata kodunu kullanıcıya gösterilecek Türkçe metne çevirir. */
export function errorMessage(code: GameErrorCode | null): string {
  if (!code) return "";
  return MESSAGES[code] ?? MESSAGES.unknown;
}

/**
 * Supabase/PostgREST hatasından oyun hata kodunu çıkarır.
 * PL/pgSQL `raise exception 'cell_occupied'` -> `error.message === "cell_occupied"`.
 */
export function toGameErrorCode(error: unknown): GameErrorCode {
  if (!error) return "unknown";

  const message =
    typeof error === "string"
      ? error
      : ((error as PostgrestError | Error)?.message ?? "");

  if (KNOWN_CODES.has(message)) return message as GameErrorCode;

  // Ağ katmanı hataları PostgREST'e hiç ulaşmadan burada biter.
  if (/fetch|network|failed to fetch/i.test(message)) return "network";
  if (/jwt|token|session/i.test(message)) return "not_authenticated";

  return "unknown";
}

/** Kısa yol: hatayı doğrudan Türkçe metne çevirir. */
export function toGameErrorMessage(error: unknown): string {
  return errorMessage(toGameErrorCode(error));
}
