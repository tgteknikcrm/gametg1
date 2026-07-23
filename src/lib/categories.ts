import { Factory, Home, Landmark, TreePine, type LucideIcon } from "lucide-react";

import type { ObjectCategory } from "@/types/game";

/**
 * Kategori etiketleri, ikonları ve sırası — saf arayüz verisi.
 *
 * Denge verisi DEĞİL: fiyat, ölçü, seviye kapısı gibi her şey `object_types`
 * tablosunda. Burada yalnızca sekmelerin görünümü var.
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

export const CATEGORY_ICONS: Record<ObjectCategory, LucideIcon> = {
  production: Factory,
  housing: Home,
  civic: Landmark,
  decor: TreePine,
};
