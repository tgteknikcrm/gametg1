"use client";

import { CELL_SIZE, footprintCenterWorld, rotatedFootprint } from "@/lib/grid";
import { selectionMaterial, unitBoxEdgesGeometry } from "@/lib/three-assets";
import { useGameStore } from "@/store/useGameStore";
import { getObjectType, useWorldStore } from "@/store/useWorldStore";

/** Seçili nesnenin çevresine sarı tel kafes çizer. */
export function SelectionOutline() {
  const mode = useGameStore((state) => state.mode);
  const selectedObjectId = useGameStore((state) => state.selectedObjectId);
  const object = useWorldStore((state) =>
    state.objects.find((candidate) => candidate.id === selectedObjectId),
  );

  const type = getObjectType(object?.type_id ?? null);
  // Taşıma sırasında nesne gizlendiği için kafes de gizlenir.
  if (!object || !type || mode === "move") return null;

  const { w, h } = rotatedFootprint(type.width, type.height, object.rotation);
  const [cx, cz] = footprintCenterWorld({ x: object.local_x, y: object.local_y }, w, h);

  return (
    <lineSegments
      geometry={unitBoxEdgesGeometry}
      material={selectionMaterial}
      position={[cx, 0.01, cz]}
      scale={[w * CELL_SIZE * 0.98, type.block_height * 1.02, h * CELL_SIZE * 0.98]}
      raycast={() => null}
    />
  );
}
