"use client";

import { Canvas } from "@react-three/fiber";

import { CameraRig } from "@/components/game/CameraRig";
import { Ground } from "@/components/game/Ground";
import { HoverHighlight } from "@/components/game/HoverHighlight";
import { PlacedObjects } from "@/components/game/PlacedObjects";
import { PlacementGhost } from "@/components/game/PlacementGhost";
import { SelectionOutline } from "@/components/game/SelectionOutline";
import { StateMarkers } from "@/components/game/StateMarkers";
import type { GhostExecutor } from "@/store/useGameStore";

/**
 * Sahnenin kökü.
 *
 * Gölge kapalı: Faz 1'de her şey statik, gerçek zamanlı gölge haritası entegre
 * grafikte bedava değil. Brief madde 7 uyarınca gölgeler yalnızca hareketli
 * nesneler geldiğinde açılacak.
 *
 * Tuval şeffaf (`alpha`): gökyüzü CSS degradesi olarak arkada duruyor. Düz bir
 * renkten çok daha iyi görünüyor ve tek bir piksel bile GPU'ya mal olmuyor.
 *
 * `dpr` üst sınırı 1.5: retina olmayan bir dizüstünde 2x piksel oranı, kazandırdığı
 * netlikten çok daha pahalıya mal oluyor.
 */
export default function GameCanvas({ executor }: { executor: GhostExecutor }) {
  return (
    <Canvas
      orthographic
      shadows={false}
      dpr={[1, 1.5]}
      camera={{ position: [40, 40, 40], zoom: 42, near: 0.1, far: 400 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={1.9} />
      <directionalLight position={[18, 26, 12]} intensity={2.4} />
      <directionalLight position={[-14, 10, -18]} intensity={0.6} />

      <CameraRig />
      <Ground executor={executor} />
      <HoverHighlight />
      <PlacedObjects />
      <StateMarkers />
      <SelectionOutline />
      <PlacementGhost />
    </Canvas>
  );
}
