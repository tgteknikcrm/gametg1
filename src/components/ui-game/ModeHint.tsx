"use client";

import { Hammer, MousePointer2, Move } from "lucide-react";

import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/useGameStore";
import type { Mode } from "@/types/game";

const MODE_META: Record<Mode, { label: string; hint: string; icon: typeof Hammer }> = {
  navigate: {
    label: "Gezinme",
    hint: "Sol sürükle: kaydır · Sağ sürükle: döndür · Tekerlek: yakınlaş · Nesneye tıkla: seç",
    icon: MousePointer2,
  },
  place: {
    label: "Yerleştirme",
    hint: "Tıkla: inşa et · Q/E: 90° döndür · Esc: çık",
    icon: Hammer,
  },
  move: {
    label: "Taşıma",
    hint: "Tıkla: yeni yere bırak · Q/E: 90° döndür · Esc: iptal",
    icon: Move,
  },
};

/** Alt orta şerit: aktif mod, kısayollar ve geçersiz yerleştirme sebebi. */
export function ModeHint() {
  const mode = useGameStore((state) => state.mode);
  const ghostReason = useGameStore((state) => state.ghostReason);
  const hasPlan = useGameStore((state) => state.ghostPlan !== null);

  const meta = MODE_META[mode];
  const Icon = meta.icon;
  const problem = hasPlan && ghostReason ? errorMessage(ghostReason) : null;

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-slate-900/85 py-2 pr-4 pl-3 text-slate-200 shadow-lg backdrop-blur">
      <span
        className={cn(
          "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
          mode === "navigate" && "bg-slate-700/80 text-slate-100",
          mode === "place" && "bg-emerald-500/25 text-emerald-200",
          mode === "move" && "bg-sky-500/25 text-sky-200",
        )}
      >
        <Icon className="size-3.5" />
        {meta.label}
      </span>

      <span className="text-xs text-slate-400">{meta.hint}</span>

      {problem && (
        <span className="rounded-full bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-200">
          {problem}
        </span>
      )}
    </div>
  );
}
