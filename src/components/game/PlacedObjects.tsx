"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useRef } from "react";
import * as THREE from "three";

import { useDragAwareClick } from "@/hooks/useDragAwareClick";
import { CELL_SIZE, footprintCenterWorld, rotatedFootprint } from "@/lib/grid";
import {
  buildingMaterial,
  foundationMaterial,
  unitBoxGeometry,
  unitTileGeometry,
} from "@/lib/three-assets";
import { useGameStore } from "@/store/useGameStore";
import { getObjectType, useWorldStore } from "@/store/useWorldStore";

/** Kapasite baştan ayrılır; `count` ile kaç örneğin çizileceği belirlenir. */
const MAX_INSTANCES = 800;

/** Bina gövdesi hücreyi tam doldurmaz — komşularla arasında ince boşluk kalsın. */
const BODY_INSET = 0.9;

const scratchObject = new THREE.Object3D();
const scratchColor = new THREE.Color();

/**
 * Tüm binalar TEK InstancedMesh içinde çizilir: 500 nesne = 1 draw call.
 * Renk `instanceColor` ile örnek başına verilir, böylece tip başına ayrı materyal gerekmez.
 *
 * İkinci bir InstancedMesh, her binanın altına koyu bir taban serer. Gerçek gölge
 * yerine geçen bu numara toplam maliyeti 1 draw call artırır ve gövdeleri zemine oturtur.
 *
 * Faz 2+'da kutu geometrisinin yerini GLB alacak; o zaman model başına bir
 * InstancedMesh'e bölünecek — bu bileşenin dışındaki hiçbir şey değişmeyecek.
 */
export function PlacedObjects() {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const baseRef = useRef<THREE.InstancedMesh>(null);
  const instanceIds = useRef<string[]>([]);

  const objects = useWorldStore((state) => state.objects);
  // Katalog nesnelerden SONRA gelebilir. Buna abone olmazsak efekt bir daha
  // çalışmaz ve hiçbir bina çizilmez.
  const typesById = useWorldStore((state) => state.typesById);
  const mode = useGameStore((state) => state.mode);
  const selectedObjectId = useGameStore((state) => state.selectedObjectId);

  // Taşınırken nesnenin kendisi gizlenir; yerine ghost görünür.
  const hiddenId = mode === "move" ? selectedObjectId : null;

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const base = baseRef.current;
    if (!body || !base) return;

    const ids: string[] = [];
    let index = 0;

    for (const object of objects) {
      if (object.id === hiddenId) continue;
      const type = getObjectType(object.type_id);
      if (!type || index >= MAX_INSTANCES) continue;

      const { w, h } = rotatedFootprint(type.width, type.height, object.rotation);
      const [cx, cz] = footprintCenterWorld({ x: object.local_x, y: object.local_y }, w, h);

      scratchObject.position.set(cx, 0, cz);
      scratchObject.scale.set(w * CELL_SIZE * BODY_INSET, type.block_height, h * CELL_SIZE * BODY_INSET);
      scratchObject.updateMatrix();
      body.setMatrixAt(index, scratchObject.matrix);
      body.setColorAt(index, scratchColor.set(type.color));

      scratchObject.position.set(cx, 0.018, cz);
      scratchObject.scale.set(w * CELL_SIZE, 1, h * CELL_SIZE);
      scratchObject.updateMatrix();
      base.setMatrixAt(index, scratchObject.matrix);

      ids.push(object.id);
      index++;
    }

    for (const mesh of [body, base]) {
      mesh.count = index;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    instanceIds.current = ids;
  }, [objects, hiddenId, typesById]);

  const handleClick = useCallback((event: ThreeEvent<PointerEvent>) => {
    // Yerleştirme/taşıma modunda tıklama zemine ait; olayı durdurmuyoruz.
    if (useGameStore.getState().mode !== "navigate") return;

    const id = event.instanceId !== undefined ? instanceIds.current[event.instanceId] : undefined;
    if (!id) return;

    event.stopPropagation();
    useGameStore.getState().selectObject(id);
  }, []);

  const clickHandlers = useDragAwareClick(handleClick);

  return (
    <>
      <instancedMesh
        ref={baseRef}
        args={[unitTileGeometry, foundationMaterial, MAX_INSTANCES]}
        raycast={() => null}
        frustumCulled
      />
      <instancedMesh
        ref={bodyRef}
        args={[unitBoxGeometry, buildingMaterial, MAX_INSTANCES]}
        frustumCulled
        {...clickHandlers}
      />
    </>
  );
}
