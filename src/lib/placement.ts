import { areCellsFree, planFootprint, type Occupancy } from "@/lib/collision";
import type { GameErrorCode } from "@/lib/errors";
import type { GridCell, ObjectType, Rotation } from "@/types/game";

/** Ghost'un tek karelik anlık durumu — hem render hem tıklama bu plandan okur. */
export interface PlacementPlan {
  origin: GridCell;
  /** Rotasyon uygulanmış ayak izi ölçüleri. */
  w: number;
  h: number;
  /** Kaplanan hücrelerin düz indeksleri; grid dışı olanlar -1. */
  cells: number[];
  valid: boolean;
  reason: GameErrorCode | null;
}

export interface EvaluateParams {
  type: ObjectType;
  cursor: GridCell;
  rotation: Rotation;
  occupancy: Occupancy;
  /** Taşınan nesnenin dizideki indeksi; yerleştirmede -1. */
  ignoreIndex?: number;
  coins: number;
  level: number;
  /** Taşıma ücretsizdir; yeni yerleştirmede maliyet kontrol edilir. */
  chargeCost?: boolean;
}

/**
 * Tek doğrulama noktası: ghost rengi, tıklama kabulü ve hata metni hep buradan gelir.
 *
 * Faz 1'de bu fonksiyon kaldırılmayacak ama otorite olmaktan çıkacak: aynı kontroller
 * `place_object` PL/pgSQL fonksiyonunda tekrarlanacak ve son sözü sunucu söyleyecek.
 * Buradaki hâli yalnızca anlık görsel geri bildirim içindir.
 */
export function evaluatePlacement({
  type,
  cursor,
  rotation,
  occupancy,
  ignoreIndex = -1,
  coins,
  level,
  chargeCost = true,
}: EvaluateParams): PlacementPlan {
  const { origin, w, h, cells } = planFootprint(cursor, type, rotation);

  let reason: GameErrorCode | null = null;

  if (level < type.level_required) {
    reason = "level_required";
  } else if (chargeCost && coins < type.cost) {
    reason = "insufficient_funds";
  } else if (cells.some((cell) => cell < 0)) {
    reason = "out_of_bounds";
  } else if (!areCellsFree(occupancy, cells, ignoreIndex)) {
    reason = "cell_occupied";
  }

  return { origin, w, h, cells, valid: reason === null, reason };
}
