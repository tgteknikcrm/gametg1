"use client";

import { useEffect } from "react";

import type { WorldMutations } from "@/hooks/useWorldMutations";
import { useGameStore } from "@/store/useGameStore";
import { useWorldStore } from "@/store/useWorldStore";

declare global {
  interface Window {
    __game?: {
      game: typeof useGameStore;
      world: typeof useWorldStore;
      mutations: WorldMutations;
    };
  }
}

/**
 * Yalnızca geliştirme derlemesinde store'ları ve mutasyonları `window.__game`
 * altına açar. Tarayıcı konsolundan ve otomatik testlerden durum okumak için —
 * üretim paketinde bu blok tamamen elenir (NODE_ENV sabiti, dead-code elimination).
 */
export function useDevBridge(mutations: WorldMutations) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    window.__game = { game: useGameStore, world: useWorldStore, mutations };
    return () => {
      delete window.__game;
    };
  }, [mutations]);
}
