"use client";

import { getObjectType } from "@/lib/catalog";
import { CELL_SIZE, footprintCenterWorld } from "@/lib/grid";
import {
  ghostInvalidMaterial,
  ghostValidMaterial,
  unitBoxGeometry,
  unitTileGeometry,
} from "@/lib/three-assets";
import { useGameStore } from "@/store/useGameStore";
import { useWorldStore } from "@/store/useWorldStore";

/** Bina gövdesi hücreyi tam doldurmaz; komşu binalar arasında ince bir boşluk kalsın. */
const BODY_INSET = 0.92;

/**
 * Yerleştirme/taşıma hayaleti: ayak izi zeminde, gövde kutu olarak gösterilir.
 * Yeşil = geçerli, kırmızı = engel. Ön yüzü belli eden çubuk, kare ayak izlerinde
 * Q/E ile dönüşün görülebilmesi için var.
 */
export function PlacementGhost() {
  const plan = useGameStore((state) => state.ghostPlan);
  const valid = useGameStore((state) => state.ghostValid);
  const rotation = useGameStore((state) => state.ghostRotation);
  const mode = useGameStore((state) => state.mode);
  const placingTypeId = useGameStore((state) => state.placingTypeId);
  const selectedObjectId = useGameStore((state) => state.selectedObjectId);
  const movingObject = useWorldStore((state) =>
    mode === "move" ? state.objects.find((object) => object.id === selectedObjectId) : undefined,
  );

  const type = getObjectType(mode === "move" ? (movingObject?.type_id ?? null) : placingTypeId);
  if (!plan || !type || mode === "navigate") return null;

  const [cx, cz] = footprintCenterWorld(plan.origin, plan.w, plan.h);
  const material = valid ? ghostValidMaterial : ghostInvalidMaterial;

  // Ön yön: rotasyon 0'da +Z, 90'da +X, 180'de -Z, 270'te -X.
  const radians = (rotation * Math.PI) / 180;
  const dirX = Math.sin(radians);
  const dirZ = Math.cos(radians);
  const halfExtent = (rotation === 90 || rotation === 270 ? plan.w : plan.h) / 2;
  const markerDistance = Math.max(halfExtent - 0.16, 0.1);

  return (
    <group raycast={() => null}>
      <mesh
        geometry={unitTileGeometry}
        material={material}
        position={[cx, 0.03, cz]}
        scale={[plan.w * CELL_SIZE, 1, plan.h * CELL_SIZE]}
      />
      <mesh
        geometry={unitBoxGeometry}
        material={material}
        position={[cx, 0, cz]}
        scale={[plan.w * CELL_SIZE * BODY_INSET, type.block_height, plan.h * CELL_SIZE * BODY_INSET]}
      />
      <mesh
        geometry={unitTileGeometry}
        material={material}
        position={[cx + dirX * markerDistance, 0.05, cz + dirZ * markerDistance]}
        rotation={[0, radians, 0]}
        scale={[0.55, 1, 0.18]}
      />
    </group>
  );
}
