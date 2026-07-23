"use client";

import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

import { CELL_SIZE, footprintCenterWorld, rotatedFootprint } from "@/lib/grid";
import { localState } from "@/lib/production";
import { markerGeometry, markerMaterial } from "@/lib/three-assets";
import { useClockStore } from "@/store/useClockStore";
import { getObjectType, useWorldStore } from "@/store/useWorldStore";
import type { ObjectState } from "@/types/game";

const MAX_MARKERS = 800;

/** Durum renkleri; `idle` işaretlenmez — ilgi çekmesi gereken durumlar var. */
const MARKER_COLORS: Partial<Record<ObjectState, string>> = {
  building: "#cbd5e1",
  producing: "#fbbf24",
  ready: "#4ade80",
  needs_workers: "#f87171",
};

const scratchObject = new THREE.Object3D();
const scratchColor = new THREE.Color();

/**
 * Binaların üstünde yüzen durum göstergeleri.
 *
 * Hepsi tek InstancedMesh: nesne sayısı ne olursa olsun 1 draw call. Saat
 * saniyede bir ilerlediği için "hazır" rozeti sunucuyu beklemeden belirir.
 */
export function StateMarkers() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const objects = useWorldStore((state) => state.objects);
  const syncedAt = useWorldStore((state) => state.syncedAt);
  const now = useClockStore((state) => state.now);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    let index = 0;
    for (const object of objects) {
      const type = getObjectType(object.type_id);
      if (!type || index >= MAX_MARKERS) continue;

      const color = MARKER_COLORS[localState(object, syncedAt, now)];
      if (!color) continue;

      const { w, h } = rotatedFootprint(type.width, type.height, object.rotation);
      const [cx, cz] = footprintCenterWorld({ x: object.local_x, y: object.local_y }, w, h);

      scratchObject.position.set(cx, type.block_height + 0.28, cz);
      scratchObject.scale.setScalar(Math.min(1.4, 0.75 + Math.max(w, h) * 0.18) * CELL_SIZE);
      scratchObject.updateMatrix();

      mesh.setMatrixAt(index, scratchObject.matrix);
      mesh.setColorAt(index, scratchColor.set(color));
      index++;
    }

    mesh.count = index;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [objects, syncedAt, now]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[markerGeometry, markerMaterial, MAX_MARKERS]}
      raycast={() => null}
      frustumCulled
    />
  );
}
