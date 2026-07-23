"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useRef } from "react";

/**
 * MapControls sol tuşu pan için kullanıyor. Bu yüzden "tıklama" ile "sürükleme"yi
 * ayırmak zorundayız: basma ve bırakma arasında imleç eşikten az oynadıysa tıklamadır.
 * Aksi hâlde haritayı her kaydırışta yanlışlıkla bina dikilirdi.
 */
const DRAG_THRESHOLD_PX = 6;

export function useDragAwareClick(onClick: (event: ThreeEvent<PointerEvent>) => void) {
  const origin = useRef<{ x: number; y: number } | null>(null);

  return {
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      if (event.nativeEvent.button !== 0) return;
      origin.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY };
    },
    onPointerUp: (event: ThreeEvent<PointerEvent>) => {
      const start = origin.current;
      origin.current = null;
      if (!start || event.nativeEvent.button !== 0) return;

      const dx = event.nativeEvent.clientX - start.x;
      const dy = event.nativeEvent.clientY - start.y;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) return;

      onClick(event);
    },
  };
}
