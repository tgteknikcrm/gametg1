"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { CELL_SIZE, footprintCenterWorld, rotatedFootprint } from "@/lib/grid";
import { localState } from "@/lib/production";
import { markerGeometry, markerMaterial } from "@/lib/three-assets";
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
 * Binaların üstünde yüzen durum göstergeleri — tek InstancedMesh, 1 draw call.
 *
 * Güncelleme `useFrame` içinde ve store'dan İMPERATİF okumayla yapılıyor:
 * saatin saniyede bir tikleyen React durumuna abone olsaydık, hiçbir şey
 * değişmese bile saniyede bir tüm sahne yeniden render olurdu.
 *
 * Yalnızca bir örneğin durumu değiştiğinde matris yazıyoruz; sabit sahnede
 * her karedeki iş bir karşılaştırma döngüsünden ibaret.
 */
export function StateMarkers() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const signature = useRef("");

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const { objects, syncedAt, typesById } = useWorldStore.getState();
    if (syncedAt === 0) return;
    const now = Date.now();

    // Durum kümesi değişmediyse hiçbir şey yazma.
    let stamp = "";
    for (const object of objects) {
      if (!typesById.has(object.type_id)) continue;
      stamp += localState(object, syncedAt, now)[0];
    }
    if (stamp === signature.current) return;
    signature.current = stamp;

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
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[markerGeometry, markerMaterial, MAX_MARKERS]}
      raycast={() => null}
      frustumCulled
    />
  );
}
