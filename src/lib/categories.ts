import type { ObjectCategory } from "@/types/game";

/**
 * Kategori etiketleri ve sırası — saf arayüz verisi.
 *
 * Denge verisi DEĞİL: fiyat, ölçü, seviye kapısı gibi her şey `object_types`
 * tablosunda. Burada yalnızca sekmelerin Türkçe adı ve sırası var.
 */
export const CATEGORY_ORDER: readonly ObjectCategory[] = [
  "production",
  "housing",
  "civic",
  "decor",
];

export const CATEGORY_LABELS: Record<ObjectCategory, string> = {
  production: "Üretim",
  housing: "Konut",
  civic: "Kamu",
  decor: "Süsleme",
};
