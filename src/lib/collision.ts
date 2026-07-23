import { CELL_COUNT, cellIndex, footprintCells, footprintOrigin, rotatedFootprint } from "@/lib/grid";
import type { GridCell, ObjectType, PlacedObject } from "@/types/game";

/**
 * Doluluk haritası: hücre başına 1 tamsayı.
 *   0  -> boş
 *   n  -> `objects[n - 1]` bu hücreyi kaplıyor
 *
 * Nesne listesi üzerinde döngü kurmak yerine sabit maliyetli arama yapmak için var.
 * Yalnızca mutasyonlarda yeniden kurulur (O(nesne sayısı)), okuma O(1).
 */
export type Occupancy = Int32Array;

export const EMPTY_OCCUPANCY: Occupancy = new Int32Array(CELL_COUNT);

/** Yerleştirilmiş nesnelerden doluluk haritasını sıfırdan kurar. */
export function buildOccupancy(
  objects: readonly PlacedObject[],
  typesById: ReadonlyMap<string, ObjectType>,
): Occupancy {
  const grid = new Int32Array(CELL_COUNT);
  for (let i = 0; i < objects.length; i++) {
    const object = objects[i];
    const type = typesById.get(object.type_id);
    if (!type) continue;
    for (const cell of occupiedCells(object, type)) {
      if (cell >= 0) grid[cell] = i + 1;
    }
  }
  return grid;
}

/** Tek bir yerleştirilmiş nesnenin kapladığı hücreler. */
export function occupiedCells(object: PlacedObject, type: ObjectType): number[] {
  const { w, h } = rotatedFootprint(type.width, type.height, object.rotation);
  return footprintCells({ x: object.local_x, y: object.local_y }, w, h);
}

/**
 * Verilen hücrelerin tamamı boş mu?
 * `ignoreIndex` taşınan nesnenin kendi indeksidir — kendi üzerine taşımak çakışma sayılmaz.
 */
export function areCellsFree(
  occupancy: Occupancy,
  cells: readonly number[],
  ignoreIndex = -1,
): boolean {
  for (const cell of cells) {
    if (cell < 0) return false; // grid dışı
    const occupant = occupancy[cell];
    if (occupant !== 0 && occupant - 1 !== ignoreIndex) return false;
  }
  return true;
}

/** Hücreyi kaplayan nesnenin dizideki indeksi; boşsa -1. */
export function objectIndexAt(occupancy: Occupancy, cell: GridCell): number {
  return occupancy[cellIndex(cell.x, cell.y)] - 1;
}

/** İmleç hücresinden ayak izinin sol-üst köşesini ve kapladığı hücreleri üretir. */
export function planFootprint(
  cursor: GridCell,
  type: ObjectType,
  rotation: PlacedObject["rotation"],
): { origin: GridCell; w: number; h: number; cells: number[] } {
  const { w, h } = rotatedFootprint(type.width, type.height, rotation);
  const origin = footprintOrigin(cursor, w, h);
  return { origin, w, h, cells: footprintCells(origin, w, h) };
}
