"use client";

import { useEffect } from "react";

import type { WorldMutations } from "@/hooks/useWorldMutations";
import { useGameStore } from "@/store/useGameStore";
import { useWorldStore } from "@/store/useWorldStore";

/** Metin girişi odaktayken kısayolları yut. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/**
 * Global klavye kısayolları.
 *   Q / E      → ghost'u 90° döndür
 *   Escape     → moddan çık, seçimi temizle
 *   Delete     → seçili nesneyi kaldır (yalnızca kendi binan)
 */
export function useKeyboardControls(mutations: WorldMutations) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const game = useGameStore.getState();

      switch (event.key.toLowerCase()) {
        case "q":
          game.rotateGhost(-1);
          break;
        case "e":
          game.rotateGhost(1);
          break;
        case "escape":
          game.cancel();
          break;
        case "delete":
        case "backspace": {
          if (game.mode !== "navigate" || !game.selectedObjectId) return;
          const world = useWorldStore.getState();
          const target = world.objectById(game.selectedObjectId);
          if (!target) return;
          event.preventDefault();
          if (target.owner_id !== world.userId) {
            game.notify("Bu nesne sana ait değil", "error");
            return;
          }
          // Doğrudan silmiyoruz; onay penceresi açılıyor.
          game.requestRemoval(target.id);
          break;
        }
        default:
          return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mutations]);
}
