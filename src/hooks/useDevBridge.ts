"use client";

import { useEffect } from "react";

import { useGameStore } from "@/store/useGameStore";
import { useWorldStore } from "@/store/useWorldStore";

declare global {
  interface Window {
    __game?: { game: typeof useGameStore; world: typeof useWorldStore };
  }
}

/**
 * Yalnızca geliştirme derlemesinde store'ları `window.__game` altına açar.
 * Tarayıcı konsolundan ve otomatik testlerden durum okumak için — üretim
 * paketinde bu blok tamamen elenir (NODE_ENV sabiti ile dead-code elimination).
 */
export function useDevBridge() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    window.__game = { game: useGameStore, world: useWorldStore };
    return () => {
      delete window.__game;
    };
  }, []);
}
