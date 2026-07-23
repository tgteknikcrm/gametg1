"use client";

import { Coins, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ObjectType } from "@/types/game";

interface ObjectCardProps {
  type: ObjectType;
  selected: boolean;
  affordable: boolean;
  unlocked: boolean;
  onSelect: (typeId: string) => void;
}

/** Sidebar'daki tek nesne kartı. Tıklanınca yerleştirme modunu başlatır. */
export function ObjectCard({ type, selected, affordable, unlocked, onSelect }: ObjectCardProps) {
  return (
    <button
      type="button"
      disabled={!unlocked}
      onClick={() => onSelect(type.id)}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors",
        "border-white/10 bg-slate-800/60 hover:bg-slate-700/70",
        selected && "border-emerald-400/70 bg-emerald-500/15 hover:bg-emerald-500/20",
        !unlocked && "cursor-not-allowed opacity-45 hover:bg-slate-800/60",
      )}
    >
      <span
        aria-hidden
        className="size-9 shrink-0 rounded-md border border-black/20 shadow-inner"
        style={{ backgroundColor: type.color }}
      />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-100">{type.name}</span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
          <span className="tabular-nums">
            {type.width}×{type.height}
          </span>
          <span className="text-slate-600">•</span>
          <span
            className={cn(
              "flex items-center gap-1 tabular-nums",
              !affordable && unlocked && "text-rose-400",
            )}
          >
            <Coins className="size-3" />
            {type.cost.toLocaleString("tr-TR")}
          </span>
        </span>
      </span>

      {!unlocked && (
        <span className="flex shrink-0 items-center gap-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[11px] text-slate-300">
          <Lock className="size-3" />
          Sv {type.level_required}
        </span>
      )}
    </button>
  );
}
