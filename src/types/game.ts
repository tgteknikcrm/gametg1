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

/**
 * Sahnede çizilen nesne. `placed_objects` satırının yalnızca istemcinin
 * ihtiyaç duyduğu kolonları — `footprint` gibi sunucuya özel alanlar çekilmez.
 */
export type WorldObject = Pick<
  Tables["placed_objects"]["Row"],
  "id" | "owner_id" | "type_id" | "local_x" | "local_y" | "rotation" | "state" | "state_since"
>;

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
