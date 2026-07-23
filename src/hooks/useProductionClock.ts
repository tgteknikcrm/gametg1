"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { isStale } from "@/lib/production";
import { queryKeys } from "@/lib/queries";
import { useClockStore } from "@/store/useClockStore";
import { useWorldStore } from "@/store/useWorldStore";

/** Aynı anda biten çok sayıda bina için tazelemeyi bir defaya indiren pencere. */
const REFETCH_COOLDOWN_MS = 4000;

/**
 * Oyunun kalp atışı.
 *
 * Saniyede bir ortak saati ilerletir (geri sayımlar akıcı görünsün) ve yerel
 * sayacı sıfırlanan bir bina olduğu anda dünyayı tazeler. Böylece "hazır"
 * rozeti periyodik yoklamayı beklemeden, tam zamanında belirir.
 *
 * Cron yok: sunucu hiçbir şeyi ilerletmiyor, yalnızca sorulduğunda hesaplıyor.
 */
export function useProductionClock() {
  const client = useQueryClient();
  const lastRefetch = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      useClockStore.getState().tick();

      const { objects, syncedAt } = useWorldStore.getState();
      if (syncedAt === 0) return;

      const now = Date.now();
      if (!objects.some((object) => isStale(object, syncedAt, now))) return;
      if (now - lastRefetch.current < REFETCH_COOLDOWN_MS) return;

      lastRefetch.current = now;
      void client.invalidateQueries({ queryKey: queryKeys.world });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [client]);
}
