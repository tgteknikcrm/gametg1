"use client";

import { Coins, Lock } from "lucide-react";

import { IsoBlock } from "@/components/ui-game/IsoBlock";
import { shade } from "@/lib/color";
import { cn } from "@/lib/utils";
import type { ObjectType } from "@/types/game";

interface ObjectCardProps {
  type: ObjectType;
  selected: boolean;
  affordable: boolean;
  unlocked: boolean;
  onSelect: (typeId: string) => void;
}

/** Izgara içindeki yüzen bina kartı. Tıklanınca yerleştirme modunu başlatır. */
export function ObjectCard({ type, selected, affordable, unlocked, onSelect }: ObjectCardProps) {
  return (
    <button
      type="button"
      disabled={!unlocked}
      onClick={() => onSelect(type.id)}
      title={unlocked ? type.name : `${type.name} — Seviye ${type.level_required} gerekiyor`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all duration-150",
        "border-white/8 bg-white/[0.04] hover:-translate-y-0.5 hover:border-white/16 hover:bg-white/[0.08]",
        "hover:shadow-[0_10px_24px_-10px_rgba(0,0,0,0.7)]",
        selected &&
          "border-emerald-400/60 bg-emerald-400/12 shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_10px_28px_-10px_rgba(16,185,129,0.5)]",
        !unlocked && "cursor-not-allowed opacity-40 hover:translate-y-0 hover:border-white/8 hover:bg-white/[0.04]",
      )}
    >
      <span
        className="relative flex h-[62px] items-center justify-center"
        style={{
          background: `linear-gradient(160deg, ${shade(type.color, 0.1)}22, ${shade(type.color, -0.5)}33)`,
        }}
      >
        <IsoBlock color={type.color} size={46} tall={type.block_height > 1.6} />

        <span className="absolute top-1.5 right-1.5 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white/85 tabular-nums">
          {type.width}×{type.height}
        </span>

        {!unlocked && (
          <span className="absolute inset-0 flex items-center justify-center gap-1 bg-slate-950/55 text-[11px] font-semibold text-slate-200">
            <Lock className="size-3" />
            Sv {type.level_required}
          </span>
        )}
      </span>

      <span className="flex flex-col gap-0.5 px-2.5 py-2">
        <span className="truncate text-[13px] leading-tight font-medium text-slate-100">
          {type.name}
        </span>
        <span
          className={cn(
            "flex items-center gap-1 text-[11px] font-semibold tabular-nums",
            affordable ? "text-amber-300/90" : "text-rose-400",
          )}
        >
          <Coins className="size-3" />
          {type.cost.toLocaleString("tr-TR")}
        </span>
      </span>
    </button>
  );
}
