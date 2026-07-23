"use client";

import { ArrowUp, Boxes, Gem, Hammer, PackageCheck, TriangleAlert, Zap } from "lucide-react";

import { useProductionMutations } from "@/hooks/useProductionMutations";
import { formatDuration } from "@/lib/duration";
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
import { useWorldStore } from "@/store/useWorldStore";
import type { ObjectType, WorldObject } from "@/types/game";

/**
 * Seçili binanın üretim ve yükseltme paneli.
 *
 * Üretim sürekli: bina inşaat biter bitmez kendiliğinden üretir, tıklamaya gerek
 * yok. Panel yalnızca ne ürettiğini, ne kadar biriktiğini ve bir sonraki
 * seviyenin ne getireceğini gösterir.
 */
export function ProductionSection({
  object,
  type,
  isMine,
}: {
  object: WorldObject;
  type: ObjectType;
  isMine: boolean;
}) {
  const now = useClockStore((state) => state.now);
  const syncedAt = useWorldStore((state) => state.syncedAt);
  const itemsById = useWorldStore((state) => state.itemsById);
  const levelOf = useWorldStore((state) => state.levelOf);
  const costsOf = useWorldStore((state) => state.costsOf);
  const inventory = useWorldStore((state) => state.inventory);
  const coins = useWorldStore((state) => state.profile?.coins ?? 0);
  const production = useProductionMutations();

  const state = localState(object, syncedAt, now);
  const level = object.effective_level ?? object.level ?? 1;
  const busy = state === "building";
  const upgrading = busy && object.pending_level !== null;

  const outputItem = type.output_item_id ? itemsById.get(type.output_item_id) : null;
  const inputItem = type.input_item_id ? itemsById.get(type.input_item_id) : null;

  const next = levelOf(type.id, level + 1);
  const nextCosts = costsOf(type.id, level + 1);
  const canAffordCoins = next?.upgrade_coins != null && coins >= next.upgrade_coins;
  const materialsOk = nextCosts.every((cost) => (inventory.get(cost.item_id) ?? 0) >= cost.quantity);

  return (
    <div className="flex flex-col gap-3 px-3.5 pt-3">
      {/* --- inşaat / yükseltme --- */}
      {busy && (
        <div className="flex flex-col gap-2">
          <Bar value={localProgress(object, object.state_duration ?? 0, syncedAt, now)} tint="bg-slate-200" />
          <p className="flex items-center gap-1.5 text-[11px] text-slate-300">
            <Hammer className="size-3.5 text-slate-500" />
            {upgrading ? `Seviye ${object.pending_level}'e yükseltiliyor` : "İnşa ediliyor"}
            <span className="ml-auto font-semibold tabular-nums">
              {formatDuration(localRemainingSeconds(object, syncedAt, now))}
            </span>
          </p>
          {isMine && (
            <button
              type="button"
              onClick={() => production.rush(object.id)}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-cyan-400/15 px-3 py-2 text-xs font-semibold text-cyan-300 ring-1 ring-cyan-400/30 transition-colors hover:bg-cyan-400/25"
            >
              <Zap className="size-3.5" />
              Elmasla anında bitir
            </button>
          )}
        </div>
      )}

      {/* --- sürekli üretim --- */}
      {!busy && type.produce_seconds !== null && outputItem && (
        <div className="hud-inset flex flex-col gap-2 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-300">
            <PackageCheck className="size-3.5" />
            Sürekli üretiyor
            <span className="ml-auto text-slate-300 tabular-nums">
              {object.cycle_output} {outputItem.name} / {formatDuration(object.cycle_seconds ?? 0)}
            </span>
          </p>

          <Bar value={localCycleProgress(object, syncedAt, now)} tint="bg-amber-400" />

          <p className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Sonraki tur: {formatDuration(localCycleRemaining(object, syncedAt, now))}</span>
            <span className="font-semibold text-slate-200 tabular-nums">
              {localPendingQty(object, syncedAt, now)} bekliyor
            </span>
          </p>

          {inputItem && (
            <p className="flex items-center gap-1.5 border-t border-white/8 pt-2 text-[11px] text-slate-400">
              <Boxes className="size-3" />
              Tur başına {object.cycle_input} {inputItem.name}
              <span className="ml-auto tabular-nums">
                {inventory.get(inputItem.id) ?? 0} elinde
              </span>
            </p>
          )}
        </div>
      )}

      {/* --- yükseltme --- */}
      {!busy && isMine && next && next.upgrade_coins != null && (
        <div className="hud-inset flex flex-col gap-2 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-sky-300">
            <ArrowUp className="size-3.5" />
            Seviye {level + 1} — {formatDuration(next.upgrade_seconds ?? 0)}
          </p>

          <ul className="flex flex-col gap-0.5 text-[11px] text-slate-400">
            {next.output_qty != null && object.cycle_output != null && (
              <li>
                Üretim {object.cycle_output} → <b className="text-emerald-300">{next.output_qty}</b>
              </li>
            )}
            {next.produce_seconds != null && object.cycle_seconds != null && (
              <li>
                Tur {formatDuration(object.cycle_seconds)} →{" "}
                <b className="text-emerald-300">{formatDuration(next.produce_seconds)}</b>
              </li>
            )}
            {next.storage_capacity > 0 && (
              <li>
                Depo → <b className="text-emerald-300">{next.storage_capacity}</b>
              </li>
            )}
          </ul>

          <div className="flex flex-wrap gap-1.5 border-t border-white/8 pt-2">
            <Cost label="altın" have={coins} need={next.upgrade_coins} />
            {nextCosts.map((cost) => (
              <Cost
                key={cost.item_id}
                label={itemsById.get(cost.item_id)?.name ?? cost.item_id}
                have={inventory.get(cost.item_id) ?? 0}
                need={cost.quantity}
              />
            ))}
          </div>

          <button
            type="button"
            disabled={!canAffordCoins || !materialsOk}
            onClick={() => production.upgrade(object.id)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {!materialsOk && <TriangleAlert className="size-3.5" />}
            {materialsOk ? "Yükselt" : "Malzeme yetersiz"}
          </button>
        </div>
      )}

      {!busy && isMine && !next && (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Gem className="size-3" />
          Son seviye
        </p>
      )}
    </div>
  );
}

function Bar({ value, tint }: { value: number; tint: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear", tint)}
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

function Cost({ label, have, need }: { label: string; have: number; need: number }) {
  const ok = have >= need;
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ring-1",
        ok
          ? "bg-emerald-400/12 text-emerald-300 ring-emerald-400/25"
          : "bg-rose-500/12 text-rose-300 ring-rose-400/25",
      )}
    >
      {need.toLocaleString("tr-TR")} {label}
    </span>
  );
}
