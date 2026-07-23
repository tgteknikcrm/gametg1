/**
 * Faz 0'da istemci tarafı doğrulama kodları.
 *
 * Bu kodlar bilinçli olarak Faz 1'de yazılacak `SECURITY DEFINER` fonksiyonlarının
 * fırlatacağı exception adlarıyla aynıdır. Böylece sunucu doğrulaması devreye
 * girdiğinde yalnızca kodun kaynağı değişir, kullanıcıya gösterilen metin değişmez.
 */
export type GameErrorCode =
  | "out_of_bounds"
  | "cell_occupied"
  | "insufficient_funds"
  | "level_required"
  | "not_owner"
  | "not_ready"
  | "no_selection";

const MESSAGES: Record<GameErrorCode, string> = {
  out_of_bounds: "Grid dışına yerleştiremezsin",
  cell_occupied: "Bu alan dolu",
  insufficient_funds: "Yeterli altının yok",
  level_required: "Seviyen yetersiz",
  not_owner: "Bu nesne sana ait değil",
  not_ready: "Henüz hazır değil",
  no_selection: "Önce bir nesne seç",
};

/** Hata kodunu kullanıcıya gösterilecek Türkçe metne çevirir. */
export function errorMessage(code: GameErrorCode | null): string {
  if (!code) return "";
  return MESSAGES[code] ?? "Bilinmeyen hata";
}
