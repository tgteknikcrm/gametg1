"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useCallback } from "react";

import { useDragAwareClick } from "@/hooks/useDragAwareClick";
import { worldToCell } from "@/lib/grid";
import {
  gridGeometry,
  gridMaterial,
  groundGeometry,
  groundMaterial,
} from "@/lib/three-assets";
import { useGameStore, type GhostExecutor } from "@/store/useGameStore";

/**
 * Zemin: hem çim görseli hem de sahnedeki TEK raycast hedefi.
 *
 * 400 hücreyi ayrı mesh yapmak yerine tek düzleme ışın atıp hücreyi aritmetikle
 * buluyoruz — maliyet hücre sayısından bağımsız, O(1). Grid çizgileri ayrı bir
 * LineSegments; tek draw call, raycast'e katılmaz.
 *
 * `executor` prop olarak geliyor çünkü Canvas ayrı bir React reconciler kökü;
 * mutasyon hook'ları Canvas dışında çağrılıp buraya geçiliyor.
 */
export function Ground({ executor }: { executor: GhostExecutor }) {
  const setGhostPosition = useGameStore((state) => state.setGhostPosition);

  const handleMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      setGhostPosition(worldToCell(event.point.x, event.point.z));
    },
    [setGhostPosition],
  );

  const handleLeave = useCallback(() => setGhostPosition(null), [setGhostPosition]);

  const handleClick = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const store = useGameStore.getState();
      // Tıklama anındaki hücreyi tazele: kullanıcı fareyi oynatmadan Q/E'ye basmış olabilir.
      store.setGhostPosition(worldToCell(event.point.x, event.point.z));

      if (store.mode === "navigate") {
        store.selectObject(null);
        return;
      }
      useGameStore.getState().commitGhost(executor);
    },
    [executor],
  );

  const clickHandlers = useDragAwareClick(handleClick);

  return (
    <group>
      <mesh
        geometry={groundGeometry}
        material={groundMaterial}
        onPointerMove={handleMove}
        onPointerOut={handleLeave}
        {...clickHandlers}
      />
      <lineSegments
        geometry={gridGeometry}
        material={gridMaterial}
        position={[0, 0.012, 0]}
        raycast={() => null}
      />
    </group>
  );
}
