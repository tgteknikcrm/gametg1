import type { Database } from "@/types/database";

/**
 * Oyun tipleri.
 *
 * Veritabanı satır tipleri ELLE YAZILMAZ — hepsi `src/types/database.ts`
 * üzerinden gelir, o dosya da şemadan üretilir (`npm run gen:types`).
 * Burada yalnızca istemciye özgü arayüz tipleri tanımlanır.
 */

type Tables = Database["public"]["Tables"];

export type ObjectType = Tables["object_types"]["Row"];
export type Profile = Tables["profiles"]["Row"];
export type Parcel = Tables["parcels"]["Row"];
export type City = Tables["cities"]["Row"];
export type Item = Tables["items"]["Row"];

export type ObjectCategory = Database["public"]["Enums"]["object_category"];
export type ObjectState = Database["public"]["Enums"]["object_state"];

export type InventoryRow = Tables["inventory"]["Row"];
export type LedgerRow = Tables["ledger"]["Row"];
export type ObjectLevel = Tables["object_levels"]["Row"];
export type ObjectLevelCost = Tables["object_level_costs"]["Row"];
export type StorageStatus = Database["public"]["Views"]["storage_status"]["Row"];

/** Depo sınıfı: tahıl zinciri ve diğer mallar ayrı ambarlarda tutulur. */
export type StorageClass = "grain" | "goods";

/**
 * Sahnede çizilen nesne — `world_objects` görünümünden gelir.
 *
 * Görünüm, ham satıra üç türev alan ekler: `effective_state` (zaman uygulanmış
 * gerçek durum), `finishes_at` ve `remaining_seconds`. Bunlar sunucuda
 * hesaplanır; istemci yalnızca aradaki saniyeleri sayar.
 */
export type WorldObject = Pick<
  Database["public"]["Views"]["world_objects"]["Row"],
  | "id"
  | "owner_id"
  | "type_id"
  | "local_x"
  | "local_y"
  | "rotation"
  | "state"
  | "state_since"
  | "state_duration"
  | "last_collected_at"
  | "effective_state"
  | "finishes_at"
  | "remaining_seconds"
  // --- Faz 2.5: seviye ve sürekli üretim
  | "level"
  | "pending_level"
  | "effective_level"
  | "cycle_seconds"
  | "cycle_output"
  | "cycle_input"
  | "pending_cycles"
  | "pending_qty"
  | "cycle_remaining_seconds"
> & {
  id: string;
  type_id: string;
  local_x: number;
  local_y: number;
  rotation: number;
};

/** Sunucudan gelen `rotation` number'dır; arayüz tarafında daraltıp kullanıyoruz. */
export type Rotation = 0 | 90 | 180 | 270;

export function asRotation(value: number): Rotation {
  return (value === 90 || value === 180 || value === 270 ? value : 0) as Rotation;
}

/** Oyuncunun içinde bulunduğu etkileşim modu. */
export type Mode = "navigate" | "place" | "move";

/** Grid üzerindeki tamsayı hücre koordinatı. (0,0) sol-üst köşedir. */
export interface GridCell {
  x: number;
  y: number;
}
