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
  profile_missing: "Bu oturum artık geçerli değil, tekrar giriş yapman gerekiyor",
  parcel_missing: "Şehirde uygun arsa yok",
  no_selection: "Önce bir nesne seç",
  network: "Sunucuya ulaşılamadı",
  unknown: "Beklenmeyen bir hata oldu",
};

const KNOWN_CODES = new Set(Object.keys(MESSAGES));

/** İstemci tarafında bilinçli olarak fırlatılan, kodu taşıyan hata. */
export class GameError extends Error {
  readonly code: GameErrorCode;

  constructor(code: GameErrorCode) {
    super(code);
    this.name = "GameError";
    this.code = code;
  }
}

/**
 * Oturum bu hatalardan sonra kurtarılamaz — yeniden denemek işe yaramaz,
 * tek çıkış yolu yeniden giriş.
 */
export function isFatalSessionError(code: GameErrorCode): boolean {
  return code === "profile_missing" || code === "not_authenticated";
}

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
  if (error instanceof GameError) return error.code;

  const message =
    typeof error === "string"
      ? error
      : ((error as PostgrestError | Error)?.message ?? "");

  if (KNOWN_CODES.has(message)) return message as GameErrorCode;

  // PostgREST'in kendi hata kodları. PGRST116: beklenen tek satır bulunamadı —
  // örneğin oturum jetonu geçerli ama profil satırı silinmişse.
  const pgCode = typeof error === "object" ? (error as PostgrestError)?.code : undefined;
  if (pgCode === "PGRST116") return "not_found";
  if (pgCode === "PGRST301" || pgCode === "42501") return "not_authenticated";

  // Ağ katmanı hataları PostgREST'e hiç ulaşmadan burada biter.
  if (/fetch|network|failed to fetch|load failed/i.test(message)) return "network";
  if (/jwt|token|session|refresh/i.test(message)) return "not_authenticated";

  return "unknown";
}

/** Kısa yol: hatayı doğrudan Türkçe metne çevirir. */
export function toGameErrorMessage(error: unknown): string {
  return errorMessage(toGameErrorCode(error));
}
