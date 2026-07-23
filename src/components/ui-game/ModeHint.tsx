"use client";

import { Hammer, MousePointer2, Move, TriangleAlert } from "lucide-react";

import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/useGameStore";
import type { Mode } from "@/types/game";

interface Hint {
  keys: string[];
  text: string;
}

const MODE_META: Record<
  Mode,
  { label: string; icon: typeof Hammer; tint: string; hints: Hint[] }
> = {
  navigate: {
    label: "Gezinme",
    icon: MousePointer2,
    tint: "bg-slate-500/20 text-slate-200 ring-slate-400/25",
    hints: [
      { keys: ["Sol"], text: "kaydır" },
      { keys: ["Sağ"], text: "döndür" },
      { keys: ["Tekerlek"], text: "yakınlaş" },
    ],
  },
  place: {
    label: "Yerleştirme",
    icon: Hammer,
    tint: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/30",
    hints: [
      { keys: ["Tık"], text: "inşa et" },
      { keys: ["Q", "E"], text: "döndür" },
      { keys: ["Esc"], text: "çık" },
    ],
  },
  move: {
    label: "Taşıma",
    icon: Move,
    tint: "bg-sky-500/20 text-sky-200 ring-sky-400/30",
    hints: [
      { keys: ["Tık"], text: "bırak" },
      { keys: ["Q", "E"], text: "döndür" },
      { keys: ["Esc"], text: "iptal" },
    ],
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
    <div className="hud-card pointer-events-none absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 py-1.5 pr-3.5 pl-1.5">
      <span
        className={cn(
          "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold ring-1",
          meta.tint,
        )}
      >
        <Icon className="size-3.5" />
        {meta.label}
      </span>

      <span className="flex items-center gap-3">
        {meta.hints.map((hint) => (
          <span key={hint.text} className="flex items-center gap-1.5 text-[11px] text-slate-400">
            {hint.keys.map((key) => (
              <kbd key={key} className="kbd">
                {key}
              </kbd>
            ))}
            {hint.text}
          </span>
        ))}
      </span>

      {problem && (
        <span className="flex items-center gap-1.5 rounded-xl bg-rose-500/20 px-2.5 py-1.5 text-xs font-semibold text-rose-200 ring-1 ring-rose-400/30">
          <TriangleAlert className="size-3.5" />
          {problem}
        </span>
      )}
    </div>
  );
}
