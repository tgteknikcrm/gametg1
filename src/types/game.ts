/**
 * Faz 0 oyun tipleri.
 *
 * NOT: `ObjectType` ve `PlacedObject`, ileride Supabase'de oluşturulacak
 * `object_types` ve `placed_objects` tablolarının birebir kolon aynasıdır.
 * Faz 1'de bu dosyanın yerini `supabase gen types` çıktısı alacak;
 * o yüzden kolon adları snake_case tutuldu ve hiçbir yerde çoğaltılmadı.
 */

/** Oyuncunun içinde bulunduğu etkileşim modu. */
export type Mode = "navigate" | "place" | "move";

/** Yerleştirme rotasyonu — yalnızca 90° adımlar. */
export type Rotation = 0 | 90 | 180 | 270;

/** `object_types.category` için sabit küme. */
export type ObjectCategory = "production" | "housing" | "civic" | "decor";

/** `placed_objects.state` enum'unun aynası. */
export type ObjectState =
  | "building"
  | "idle"
  | "producing"
  | "ready"
  | "needs_workers";

/** Grid üzerindeki tamsayı hücre koordinatı. (0,0) sol-üst köşedir. */
export interface GridCell {
  x: number;
  y: number;
}

/** `object_types` tablosunun aynası + yalnızca Faz 0'a ait görsel alanlar. */
export interface ObjectType {
  id: string;
  category: ObjectCategory;
  name: string;
  model_key: string;
  /** Ayak izi genişliği (X ekseni, rotasyon 0'da). */
  width: number;
  /** Ayak izi derinliği (Z ekseni, rotasyon 0'da). */
  height: number;
  cost: number;
  build_seconds: number;
  produce_seconds: number | null;
  input_item_id: string | null;
  input_qty: number | null;
  output_item_id: string | null;
  output_qty: number | null;
  worker_slots: number;
  population_capacity: number;
  maintenance_per_hour: number;
  level_required: number;

  // --- Faz 0'a özel: kutu primitifi görselleştirmesi (Faz 1'de GLB'ye devredilir)
  /** Kutunun hex rengi. */
  color: string;
  /** Kutunun dünya birimi cinsinden yüksekliği. */
  block_height: number;
}

/** `placed_objects` tablosunun aynası (Faz 0'da parcel_id/owner_id yok). */
export interface PlacedObject {
  id: string;
  type_id: string;
  local_x: number;
  local_y: number;
  rotation: Rotation;
  state: ObjectState;
}

/** Üst barda gösterilen oyuncu durumu — Faz 1'de `profiles` satırından gelecek. */
export interface PlayerState {
  coins: number;
  energy: number;
  energy_max: number;
  level: number;
  xp: number;
  xp_to_next: number;
}
