"use client";

import { cellToWorld } from "@/lib/grid";
import { hoverMaterial, unitTileGeometry } from "@/lib/three-assets";
import { useGameStore } from "@/store/useGameStore";

/**
 * İmlecin altındaki tek hücreyi vurgular. Yalnızca `navigate` modunda görünür;
 * yerleştirme/taşıma modlarında ghost zaten aynı bilgiyi daha zengin veriyor.
 *
 * Konum hücre çözünürlüğünde güncellendiği için bu bileşen saniyede birkaç kez
 * render olur — piksel başına değil.
 */
export function HoverHighlight() {
  const cell = useGameStore((state) => state.ghostPosition);
  const mode = useGameStore((state) => state.mode);

  if (!cell || mode !== "navigate") return null;

  const [x, z] = cellToWorld(cell.x, cell.y);

  return (
    <mesh
      geometry={unitTileGeometry}
      material={hoverMaterial}
      position={[x, 0.02, z]}
      raycast={() => null}
    />
  );
}
