"use client";

import { Html } from "@react-three/drei";
import { useMemo } from "react";

import { formatDuration } from "@/lib/duration";
import { footprintCenterWorld, rotatedFootprint } from "@/lib/grid";
import {
  localCycleProgress,
  localCycleRemaining,
  localPendingQty,
  localProgress,
  localRemainingSeconds,
  localState,
} from "@/lib/production";
import { cn } from "@/lib/utils";
import { useClockStore } from "@/store/useClockStore";
import { getObjectType, useWorldStore } from "@/store/useWorldStore";
import type { ObjectType, WorldObject } from "@/types/game";

/**
 * Aynı anda gösterilecek en fazla etiket. Şehir kalabalıklaşsa bile DOM'u
 * şişirmemek için sınırlı; en acil olanlar (kalan süresi en az) öncelikli.
 */
const MAX_LABELS = 30;

type Row = {
  object: WorldObject;
  type: ObjectType;
  building: boolean;
  remaining: number;
  progress: number;
  pending: number;
  level: number;
};

/**
 * Binaların üzerinde yüzen ilerleme çubuğu, geri sayım ve seviye rozeti.
 *
 * Travian'daki gibi: yapının üstünde durur, tıklamaya gerek kalmadan neyin ne
 * kadar sürdüğünü söyler. Tıklamayı engellemesin diye `pointer-events: none`.
 * Çubuk saniyede bir güncellenen bir sayıdan besleniyor ama CSS geçişi sayesinde
 * akıcı ilerliyor — her karede React render'ı yok.
 */
export function BuildingLabels() {
  const objects = useWorldStore((state) => state.objects);
  const syncedAt = useWorldStore((state) => state.syncedAt);
  const now = useClockStore((state) => state.now);

  const visible = useMemo(() => {
    const rows: Row[] = [];

    for (const object of objects) {
      const type = getObjectType(object.type_id);
      if (!type) continue;

      const building = localState(object, syncedAt, now) === "building";
      const producing = !building && Boolean(object.cycle_seconds);
      if (!building && !producing) continue;

      rows.push({
        object,
        type,
        building,
        remaining: building
          ? localRemainingSeconds(object, syncedAt, now)
          : localCycleRemaining(object, syncedAt, now),
        progress: building
          ? localProgress(object, object.state_duration ?? 0, syncedAt, now)
          : localCycleProgress(object, syncedAt, now),
        pending: building ? 0 : localPendingQty(object, syncedAt, now),
        level: object.effective_level ?? object.level ?? 1,
      });
    }

    rows.sort((a, b) => a.remaining - b.remaining);
    return rows.slice(0, MAX_LABELS);
  }, [objects, syncedAt, now]);

  return (
    <>
      {visible.map((row) => {
        const { w, h } = rotatedFootprint(row.type.width, row.type.height, row.object.rotation);
        const [cx, cz] = footprintCenterWorld(
          { x: row.object.local_x, y: row.object.local_y },
          w,
          h,
        );

        return (
          <Html
            key={row.object.id}
            position={[cx, row.type.block_height + 0.55, cz]}
            center
            zIndexRange={[12, 0]}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            <Pill {...row} />
          </Html>
        );
      })}
    </>
  );
}

function Pill({ building, remaining, progress, pending, level }: Row) {
  return (
    <div className="flex w-[82px] flex-col items-center gap-[3px]">
      <span className="flex items-center gap-1 rounded-md bg-slate-950/85 px-1.5 py-px text-[10px] leading-[14px] font-semibold text-white shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
        <span className="text-[9px] text-violet-300">sv{level}</span>
        <span className="tabular-nums">{formatDuration(remaining)}</span>
      </span>

      <span className="h-[7px] w-full overflow-hidden rounded-full bg-slate-950/80 p-[1.5px] shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-1000 ease-linear",
            building
              ? "bg-gradient-to-r from-slate-300 to-slate-100"
              : "bg-gradient-to-r from-amber-500 to-amber-300",
          )}
          style={{ width: `${Math.max(3, Math.round(progress * 100))}%` }}
        />
      </span>

      {pending > 0 && (
        <span className="rounded-md bg-emerald-400 px-1.5 py-px text-[10px] leading-[14px] font-bold text-slate-950 shadow-[0_1px_4px_rgba(0,0,0,0.5)] tabular-nums">
          +{pending}
        </span>
      )}
    </div>
  );
}
