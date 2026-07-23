"use client";

import { MapControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { CELL_SIZE, GRID_SIZE } from "@/lib/grid";

/**
 * Gerçek izometrik eğim: kamera (1,1,1) yönünden bakınca +Y ile arasındaki açı.
 * Polar açıyı buraya kilitliyoruz ki kullanıcı sahneyi yandan/tepeden görüp
 * izometrik hissi bozamasın. Azimut (yatay dönüş) serbest.
 */
const ISO_POLAR_ANGLE = Math.atan(Math.SQRT2);

/** Kameranın grid'i tamamen kaybetmemesi için hedef noktasının sınırı. */
const PAN_LIMIT = (GRID_SIZE * CELL_SIZE) / 2 + 4;

type ControlsWithTarget = { target: THREE.Vector3; object: THREE.Object3D };

/**
 * MapControls: sol sürükle = kaydır, sağ sürükle = döndür, tekerlek = yakınlaş.
 * Hedef noktası her karede sınırlanır; kamera da aynı miktarda kaydırılır ki
 * kamera ile hedef arasındaki izometrik bağıntı bozulmasın.
 */
export function CameraRig() {
  const controlsRef = useRef<ControlsWithTarget | null>(null);
  const correction = useRef(new THREE.Vector3());

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const target = controls.target;
    const clampedX = THREE.MathUtils.clamp(target.x, -PAN_LIMIT, PAN_LIMIT);
    const clampedZ = THREE.MathUtils.clamp(target.z, -PAN_LIMIT, PAN_LIMIT);
    if (clampedX === target.x && clampedZ === target.z && target.y === 0) return;

    correction.current.set(clampedX - target.x, -target.y, clampedZ - target.z);
    target.add(correction.current);
    controls.object.position.add(correction.current);
  });

  return (
    <MapControls
      makeDefault
      // @ts-expect-error drei tipleri ref'i OrbitControls olarak veriyor; hedef alanları aynı.
      ref={controlsRef}
      enableDamping
      dampingFactor={0.12}
      minZoom={14}
      maxZoom={150}
      minPolarAngle={ISO_POLAR_ANGLE}
      maxPolarAngle={ISO_POLAR_ANGLE}
      zoomToCursor
    />
  );
}
