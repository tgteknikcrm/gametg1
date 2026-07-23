"use client";

import { Hammer, Loader2, PackageCheck, Play, TriangleAlert } from "lucide-react";

import { useProductionMutations } from "@/hooks/useProductionMutations";
import { formatDuration } from "@/lib/duration";
import { localProgress, localRemainingSeconds, localState } from "@/lib/production";
import { cn } from "@/lib/utils";
import { useClockStore } from "@/store/useClockStore";
import { useWorldStore } from "@/store/useWorldStore";
import type { ObjectType, WorldObject } from "@/types/game";

/**
 * Seçili binanın üretim durumu: ilerleme çubuğu, geri sayım ve tek eylem düğmesi.
 *
 * Durum sunucudan gelen `remaining_seconds`'a göre yerel olarak ilerletilir;
 * eylem yine de sunucuda doğrulanır (`not_ready` gelirse iş kabul edilmez).
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
  const inputHave = useWorldStore((state) => state.quantityOf(type.input_item_id));
  const production = useProductionMutations();

  const state = localState(object, syncedAt, now);
  const remaining = localRemainingSeconds(object, syncedAt, now);
  const producible = type.produce_seconds !== null;

  const outputItem = type.output_item_id ? itemsById.get(type.output_item_id) : null;
  const inputItem = type.input_item_id ? itemsById.get(type.input_item_id) : null;
  const inputNeed = type.input_qty ?? 0;
  const hasInput = !inputItem || inputHave >= inputNeed;

  if (state === "building") {
    return (
      <Frame>
        <Progress
          value={localProgress(object, type.build_seconds, syncedAt, now)}
          tint="bg-slate-300"
        />
        <Line icon={<Hammer className="size-3.5" />} label="İnşa ediliyor">
          {formatDuration(remaining)}
        </Line>
      </Frame>
    );
  }

  if (!producible) return null;

  if (state === "producing") {
    return (
      <Frame>
        <Progress
          value={localProgress(object, type.produce_seconds ?? 0, syncedAt, now)}
          tint="bg-amber-400"
        />
        <Line icon={<Loader2 className="size-3.5 animate-spin" />} label="Üretiliyor">
          {formatDuration(remaining)}
        </Line>
        {outputItem && (
          <p className="text-[11px] text-slate-500">
            Bitince: {type.output_qty} {outputItem.name}
          </p>
        )}
      </Frame>
    );
  }

  if (state === "ready") {
    return (
      <Frame>
        <button
          type="button"
          disabled={!isMine}
          onClick={() => production.harvest(object.id)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-3 py-2.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:opacity-50"
        >
          <PackageCheck className="size-4" />
          Hasat et · +{type.output_qty} {outputItem?.name ?? ""}
        </button>
      </Frame>
    );
  }

  // state === "idle"
  return (
    <Frame>
      {inputItem && (
        <p
          className={cn(
            "flex items-center gap-1.5 text-[11px]",
            hasInput ? "text-slate-400" : "text-rose-300",
          )}
        >
          {!hasInput && <TriangleAlert className="size-3" />}
          Gereken: {inputNeed} {inputItem.name}
          <span className="text-slate-500">({inputHave} elinde)</span>
        </p>
      )}
      <button
        type="button"
        disabled={!isMine || !hasInput}
        onClick={() => production.startProduction(object.id)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-3 py-2.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Play className="size-3.5" />
        Üretime başla · {formatDuration(type.produce_seconds ?? 0)}
      </button>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 px-3.5 pt-3">{children}</div>;
}

function Progress({ value, tint }: { value: number; tint: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear", tint)}
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

function Line({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-slate-300">
      <span className="text-slate-500">{icon}</span>
      {label}
      <span className="ml-auto font-semibold tabular-nums">{children}</span>
    </p>
  );
}
