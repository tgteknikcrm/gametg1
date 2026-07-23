import type { ObjectCategory, ObjectType } from "@/types/game";

/**
 * GEÇİCİ: Faz 0'da veritabanı yok, bu yüzden katalog burada duruyor.
 *
 * Brief madde 6 ("denge verisi veritabanında") Faz 1'de karşılanacak. O yüzden bu
 * dizi `object_types` tablosunun birebir kolon aynasıdır — geçiş, bu dosyayı silip
 * `supabase.from("object_types").select()` sonucunu aynı tipe bağlamaktan ibaret olacak.
 * Hiçbir bileşen bu dosyayı doğrudan import etmez; hepsi `useCatalog` üzerinden erişir.
 */
export const OBJECT_TYPES: readonly ObjectType[] = [
  // --- Üretim ---------------------------------------------------------------
  { id: "wheat_field", category: "production", name: "Buğday Tarlası", model_key: "wheat_field", width: 3, height: 3, cost: 120, build_seconds: 30, produce_seconds: 300, input_item_id: null, input_qty: null, output_item_id: "wheat", output_qty: 12, worker_slots: 2, population_capacity: 0, maintenance_per_hour: 1, level_required: 1, color: "#d8b45c", block_height: 0.2 },
  { id: "lumber_camp", category: "production", name: "Kereste Kampı", model_key: "lumber_camp", width: 2, height: 3, cost: 300, build_seconds: 60, produce_seconds: 360, input_item_id: null, input_qty: null, output_item_id: "timber", output_qty: 8, worker_slots: 3, population_capacity: 0, maintenance_per_hour: 3, level_required: 1, color: "#8d6742", block_height: 1.0 },
  { id: "mill", category: "production", name: "Değirmen", model_key: "mill", width: 2, height: 2, cost: 380, build_seconds: 75, produce_seconds: 300, input_item_id: "wheat", input_qty: 6, output_item_id: "flour", output_qty: 4, worker_slots: 2, population_capacity: 0, maintenance_per_hour: 4, level_required: 2, color: "#cbb89a", block_height: 2.1 },
  { id: "bakery", category: "production", name: "Fırın", model_key: "bakery", width: 2, height: 2, cost: 450, build_seconds: 90, produce_seconds: 420, input_item_id: "flour", input_qty: 4, output_item_id: "bread", output_qty: 6, worker_slots: 3, population_capacity: 0, maintenance_per_hour: 5, level_required: 2, color: "#c9764a", block_height: 1.4 },
  { id: "quarry", category: "production", name: "Taş Ocağı", model_key: "quarry", width: 3, height: 2, cost: 520, build_seconds: 120, produce_seconds: 600, input_item_id: null, input_qty: null, output_item_id: "stone", output_qty: 6, worker_slots: 4, population_capacity: 0, maintenance_per_hour: 6, level_required: 3, color: "#9aa1a8", block_height: 0.8 },
  { id: "textile_workshop", category: "production", name: "Tekstil Atölyesi", model_key: "textile_workshop", width: 3, height: 2, cost: 700, build_seconds: 150, produce_seconds: 540, input_item_id: "cotton", input_qty: 5, output_item_id: "cloth", output_qty: 4, worker_slots: 4, population_capacity: 0, maintenance_per_hour: 8, level_required: 3, color: "#7b8fb5", block_height: 1.5 },

  // --- Konut ----------------------------------------------------------------
  { id: "small_house", category: "housing", name: "Küçük Ev", model_key: "small_house", width: 2, height: 2, cost: 200, build_seconds: 45, produce_seconds: null, input_item_id: null, input_qty: null, output_item_id: null, output_qty: null, worker_slots: 0, population_capacity: 4, maintenance_per_hour: 2, level_required: 1, color: "#e0c9a6", block_height: 1.2 },
  { id: "town_house", category: "housing", name: "Sıra Ev", model_key: "town_house", width: 2, height: 3, cost: 420, build_seconds: 80, produce_seconds: null, input_item_id: null, input_qty: null, output_item_id: null, output_qty: null, worker_slots: 0, population_capacity: 9, maintenance_per_hour: 4, level_required: 2, color: "#d98f7a", block_height: 1.7 },
  { id: "villa", category: "housing", name: "Villa", model_key: "villa", width: 3, height: 2, cost: 780, build_seconds: 140, produce_seconds: null, input_item_id: null, input_qty: null, output_item_id: null, output_qty: null, worker_slots: 0, population_capacity: 6, maintenance_per_hour: 9, level_required: 3, color: "#f0e2c0", block_height: 1.9 },
  { id: "apartment", category: "housing", name: "Apartman", model_key: "apartment", width: 3, height: 3, cost: 950, build_seconds: 180, produce_seconds: null, input_item_id: null, input_qty: null, output_item_id: null, output_qty: null, worker_slots: 0, population_capacity: 24, maintenance_per_hour: 12, level_required: 4, color: "#b3c2d1", block_height: 3.2 },

  // --- Kamu -----------------------------------------------------------------
  { id: "market_square", category: "civic", name: "Pazar Yeri", model_key: "market_square", width: 3, height: 2, cost: 350, build_seconds: 60, produce_seconds: null, input_item_id: null, input_qty: null, output_item_id: null, output_qty: null, worker_slots: 2, population_capacity: 0, maintenance_per_hour: 3, level_required: 1, color: "#c2a06b", block_height: 0.5 },
  { id: "gym", category: "civic", name: "Spor Salonu", model_key: "gym", width: 3, height: 3, cost: 1100, build_seconds: 200, produce_seconds: null, input_item_id: null, input_qty: null, output_item_id: null, output_qty: null, worker_slots: 3, population_capacity: 0, maintenance_per_hour: 10, level_required: 4, color: "#8fb0a3", block_height: 2.0 },
  { id: "school", category: "civic", name: "Okul", model_key: "school", width: 4, height: 3, cost: 1400, build_seconds: 240, produce_seconds: null, input_item_id: null, input_qty: null, output_item_id: null, output_qty: null, worker_slots: 5, population_capacity: 0, maintenance_per_hour: 14, level_required: 5, color: "#e8e3d3", block_height: 2.3 },
  { id: "town_hall", category: "civic", name: "Belediye Binası", model_key: "town_hall", width: 4, height: 4, cost: 2500, build_seconds: 300, produce_seconds: null, input_item_id: null, input_qty: null, output_item_id: null, output_qty: null, worker_slots: 6, population_capacity: 0, maintenance_per_hour: 20, level_required: 6, color: "#d5d0c4", block_height: 3.6 },

  // --- Süsleme --------------------------------------------------------------
  { id: "tree", category: "decor", name: "Ağaç", model_key: "tree", width: 1, height: 1, cost: 20, build_seconds: 2, produce_seconds: null, input_item_id: null, input_qty: null, output_item_id: null, output_qty: null, worker_slots: 0, population_capacity: 0, maintenance_per_hour: 0, level_required: 1, color: "#4f7f43", block_height: 1.1 },
  { id: "bench", category: "decor", name: "Bank", model_key: "bench", width: 1, height: 1, cost: 15, build_seconds: 3, produce_seconds: null, input_item_id: null, input_qty: null, output_item_id: null, output_qty: null, worker_slots: 0, population_capacity: 0, maintenance_per_hour: 0, level_required: 1, color: "#8a6b4f", block_height: 0.35 },
  { id: "lamp_post", category: "decor", name: "Sokak Lambası", model_key: "lamp_post", width: 1, height: 1, cost: 35, build_seconds: 5, produce_seconds: null, input_item_id: null, input_qty: null, output_item_id: null, output_qty: null, worker_slots: 0, population_capacity: 0, maintenance_per_hour: 1, level_required: 1, color: "#5c5f66", block_height: 1.7 },
  { id: "fountain", category: "decor", name: "Çeşme", model_key: "fountain", width: 1, height: 1, cost: 90, build_seconds: 15, produce_seconds: null, input_item_id: null, input_qty: null, output_item_id: null, output_qty: null, worker_slots: 0, population_capacity: 0, maintenance_per_hour: 1, level_required: 2, color: "#a8c4d4", block_height: 0.6 },
];

/** Kategori sekmelerinin görünen adları ve sırası. */
export const CATEGORY_ORDER: readonly ObjectCategory[] = ["production", "housing", "civic", "decor"];

export const CATEGORY_LABELS: Record<ObjectCategory, string> = {
  production: "Üretim",
  housing: "Konut",
  civic: "Kamu",
  decor: "Süsleme",
};

/** id -> ObjectType sabit maliyetli arama tablosu. */
export const TYPES_BY_ID: ReadonlyMap<string, ObjectType> = new Map(
  OBJECT_TYPES.map((type) => [type.id, type]),
);

/** Kategoriye göre gruplanmış katalog — sidebar sekmelerini besler. */
export const TYPES_BY_CATEGORY: Record<ObjectCategory, readonly ObjectType[]> = {
  production: OBJECT_TYPES.filter((t) => t.category === "production"),
  housing: OBJECT_TYPES.filter((t) => t.category === "housing"),
  civic: OBJECT_TYPES.filter((t) => t.category === "civic"),
  decor: OBJECT_TYPES.filter((t) => t.category === "decor"),
};

/** Bilinmeyen id'de patlamak yerine null döner — Faz 1'de sunucu verisi gecikebilir. */
export function getObjectType(typeId: string | null): ObjectType | null {
  if (!typeId) return null;
  return TYPES_BY_ID.get(typeId) ?? null;
}
