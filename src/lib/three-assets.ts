import * as THREE from "three";

import { CELL_SIZE, GRID_SIZE } from "@/lib/grid";

/**
 * Sahnedeki tüm paylaşılan geometri ve materyaller.
 *
 * Brief madde 7: sahnede ondan az farklı materyal olmalı. Burada tam 6 tane var ve
 * her bileşen bunları import eder — JSX içinde `<meshLambertMaterial />` yazmak
 * her bileşen örneği için yeni materyal (ve yeni shader programı) üretirdi.
 */

const GROUND_EXTENT = GRID_SIZE * CELL_SIZE;

/** Tabanı y=0'da olacak şekilde kaydırılmış birim küp — tüm binalar bunu ölçekler. */
export const unitBoxGeometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

/** Seçim tel kafesi — birim küpün kenarları, seçilen nesnenin ölçüsüne göre ölçeklenir. */
export const unitBoxEdgesGeometry = new THREE.EdgesGeometry(unitBoxGeometry);

/** XZ düzlemine yatırılmış birim kare — hover ve ghost taban göstergesi. */
export const unitTileGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/** Zemin düzlemi: hem görsel çim hem de tek raycast hedefi. */
export const groundGeometry = new THREE.PlaneGeometry(GROUND_EXTENT, GROUND_EXTENT).rotateX(
  -Math.PI / 2,
);

/** Grid çizgileri: 2 × (GRID_SIZE + 1) segment, tek draw call. */
export const gridGeometry = createGridGeometry();

export const groundMaterial = new THREE.MeshLambertMaterial({ color: "#86ab5b" });

export const gridMaterial = new THREE.LineBasicMaterial({
  color: "#ffffff",
  transparent: true,
  opacity: 0.32,
});

/** Binalar tek InstancedMesh'te toplanır; renk `instanceColor` ile örnek başına verilir. */
export const buildingMaterial = new THREE.MeshLambertMaterial({ color: "#ffffff" });

export const hoverMaterial = new THREE.MeshBasicMaterial({
  color: "#ffffff",
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
});

export const ghostValidMaterial = new THREE.MeshBasicMaterial({
  color: "#4ade80",
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});

export const ghostInvalidMaterial = new THREE.MeshBasicMaterial({
  color: "#f87171",
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});

export const selectionMaterial = new THREE.LineBasicMaterial({ color: "#facc15" });

function createGridGeometry(): THREE.BufferGeometry {
  const half = GROUND_EXTENT / 2;
  const positions = new Float32Array((GRID_SIZE + 1) * 4 * 3);
  let i = 0;

  for (let n = 0; n <= GRID_SIZE; n++) {
    const offset = n * CELL_SIZE - half;
    // X eksenine paralel çizgi
    positions[i++] = -half; positions[i++] = 0; positions[i++] = offset;
    positions[i++] = half;  positions[i++] = 0; positions[i++] = offset;
    // Z eksenine paralel çizgi
    positions[i++] = offset; positions[i++] = 0; positions[i++] = -half;
    positions[i++] = offset; positions[i++] = 0; positions[i++] = half;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}
