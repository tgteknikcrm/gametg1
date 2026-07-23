"use client";

import { PackageCheck } from "lucide-react";
import { useMemo } from "react";

import { useProductionMutations } from "@/hooks/useProductionMutations";
import { localState } from "@/lib/production";
import { useClockStore } from "@/store/useClockStore";
import { useWorldStore } from "@/store/useWorldStore";

/**
 * Hasada hazır bina varsa üstte beliren toplu toplama düğmesi.
 *
 * Sunucudaki `harvest_all` önce hazır olan her şeyi toplar, sonra hammaddesi
 * yeten binaları yeniden başlatır — yirmi tarlayı tek tek tıklamak gerekmesin.
 */
export function HarvestAllButton() {
  const now = useClockStore((state) => state.now);
  const syncedAt = useWorldStore((state) => state.syncedAt);
  const objects = useWorldStore((state) => state.objects);
  const userId = useWorldStore((state) => state.userId);
  const production = useProductionMutations();

  const readyCount = useMemo(
    () =>
      objects.filter(
        (object) => object.owner_id === userId && localState(object, syncedAt, now) === "ready",
      ).length,
    [objects, userId, syncedAt, now],
  );

  if (readyCount === 0) return null;

  return (
    <button
      type="button"
      onClick={() => production.harvestAll()}
      disabled={production.isBusy}
      className="hud-card pointer-events-auto absolute top-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2.5 py-2 pr-4 pl-2.5 transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      style={{ transform: "translateX(-50%)" }}
    >
      <span className="grid size-7 place-items-center rounded-lg bg-emerald-400/18 text-emerald-300 ring-1 ring-emerald-400/30">
        <PackageCheck className="size-4" />
      </span>
      <span className="text-[13px] font-semibold text-slate-50">Hepsini topla</span>
      <span className="rounded-lg bg-emerald-400 px-2 py-0.5 text-[11px] font-bold text-slate-950 tabular-nums">
        {readyCount}
      </span>
    </button>
  );
}
