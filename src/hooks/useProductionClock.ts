"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { isStale, localCycles } from "@/lib/production";
import { queryKeys } from "@/lib/queries";
import { useClockStore } from "@/store/useClockStore";
import { useWorldStore } from "@/store/useWorldStore";
import type { ProductionMutations } from "@/hooks/useProductionMutations";

/** Aynı anda biten çok sayıda bina için tazelemeyi bir defaya indiren pencere. */
const REFETCH_COOLDOWN_MS = 4000;

/** Otomatik toplama sıklığının alt sınırı — sunucuyu gereksiz yormayalım. */
const COLLECT_COOLDOWN_MS = 15_000;

/**
 * Oyunun kalp atışı.
 *
 * Saniyede bir ortak saati ilerletir (geri sayımlar akıcı görünsün), üretim turu
 * dolan bina olduğunda biriken malı KENDİLİĞİNDEN toplar ve sunucudaki bilgi
 * bayatladığında dünyayı tazeler.
 *
 * Cron yok: sunucu hiçbir şeyi ilerletmiyor, yalnızca sorulduğunda hesaplıyor.
 * "Sürekli üretim" hissini veren şey bu döngü.
 */
export function useProductionClock(production: ProductionMutations) {
  const client = useQueryClient();
  const lastRefetch = useRef(0);
  const lastCollect = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      useClockStore.getState().tick();

      const { objects, syncedAt, userId } = useWorldStore.getState();
      if (syncedAt === 0 || !userId) return;
      const now = Date.now();

      // Kendi binalarımızda dolmuş tur varsa otomatik topla.
      const mine = objects.filter((object) => object.owner_id === userId);
      const readyToCollect = mine.some((object) => localCycles(object, syncedAt, now) > 0);

      if (readyToCollect && now - lastCollect.current >= COLLECT_COOLDOWN_MS) {
        lastCollect.current = now;
        production.collectAll(true);
        return;
      }

      if (!objects.some((object) => isStale(object, syncedAt, now))) return;
      if (now - lastRefetch.current < REFETCH_COOLDOWN_MS) return;

      lastRefetch.current = now;
      void client.invalidateQueries({ queryKey: queryKeys.world });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [client, production]);
}
