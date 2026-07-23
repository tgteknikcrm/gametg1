import type { GridCell, Rotation } from "@/types/game";

/** Grid kenar uzunluğu (hücre sayısı). Faz 3'te şehir gridine parametrik açılacak. */
export const GRID_SIZE = 20;

/** Bir hücrenin dünya birimi cinsinden kenar uzunluğu. */
export const CELL_SIZE = 1;

/** Toplam hücre sayısı — doluluk haritasının uzunluğu. */
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;

/** Grid'in dünya uzayındaki yarım genişliği (merkez orijinde). */
const HALF = (GRID_SIZE * CELL_SIZE) / 2;

/** Hücre (x, y) -> düz dizi indeksi. Sınır kontrolü yapmaz. */
export function cellIndex(x: number, y: number): number {
  return y * GRID_SIZE + x;
}

/** Hücre grid sınırları içinde mi? */
export function isInsideGrid(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE;
}

/**
 * Hücre merkezinin dünya koordinatı.
 * Grid X ekseni -> dünya X, grid Y ekseni -> dünya Z (Three.js'te Y yukarıdır).
 */
export function cellToWorld(x: number, y: number): [number, number] {
  return [x * CELL_SIZE - HALF + CELL_SIZE / 2, y * CELL_SIZE - HALF + CELL_SIZE / 2];
}

/**
 * Dünya koordinatından hücreye. Grid dışındaysa null döner.
 * Raycast tek bir zemin düzlemine yapıldığı için bu O(1)'dir.
 */
export function worldToCell(wx: number, wz: number): GridCell | null {
  const x = Math.floor((wx + HALF) / CELL_SIZE);
  const y = Math.floor((wz + HALF) / CELL_SIZE);
  return isInsideGrid(x, y) ? { x, y } : null;
}

/** Rotasyon uygulanmış ayak izi ölçüsü. 90/270'te genişlik ve derinlik yer değiştirir. */
export function rotatedFootprint(
  width: number,
  height: number,
  rotation: Rotation,
): { w: number; h: number } {
  return rotation === 90 || rotation === 270
    ? { w: height, h: width }
    : { w: width, h: height };
}

/**
 * Ayak izini imlecin *etrafına ortalar* ve sol-üst köşe hücresini döndürür.
 * Çift ölçülerde sol/üst tarafa kayar — büyük binalarda en doğal his bu.
 */
export function footprintOrigin(cursor: GridCell, w: number, h: number): GridCell {
  return {
    x: cursor.x - Math.floor((w - 1) / 2),
    y: cursor.y - Math.floor((h - 1) / 2),
  };
}

/** `footprintOrigin`'in tersi: sol-üst köşeden imlecin durması gereken hücreyi bulur. */
export function originToCursor(origin: GridCell, w: number, h: number): GridCell {
  return {
    x: origin.x + Math.floor((w - 1) / 2),
    y: origin.y + Math.floor((h - 1) / 2),
  };
}

/** Ayak izinin kapladığı hücrelerin düz indeks listesi. Grid dışı hücreler -1 olur. */
export function footprintCells(origin: GridCell, w: number, h: number): number[] {
  const cells: number[] = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const x = origin.x + dx;
      const y = origin.y + dy;
      cells.push(isInsideGrid(x, y) ? cellIndex(x, y) : -1);
    }
  }
  return cells;
}

/** Ayak izinin dünya uzayındaki merkez noktası — mesh konumlandırmak için. */
export function footprintCenterWorld(
  origin: GridCell,
  w: number,
  h: number,
): [number, number] {
  return [
    (origin.x + w / 2) * CELL_SIZE - HALF,
    (origin.y + h / 2) * CELL_SIZE - HALF,
  ];
}

/** Rotasyonu 90° adımlarla döndürür (dir: +1 saat yönü, -1 ters). */
export function stepRotation(rotation: Rotation, dir: 1 | -1): Rotation {
  return (((rotation + dir * 90) % 360) + 360) % 360 as Rotation;
}
