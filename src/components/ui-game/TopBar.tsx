"use client";

import { Coins, Star, Zap } from "lucide-react";

import { useWorldStore } from "@/store/useWorldStore";

/**
 * Üst bar: altın, enerji, seviye.
 * Faz 1'de bu değerler `profiles` satırından gelecek; bileşen değişmeyecek.
 */
export function TopBar() {
  const player = useWorldStore((state) => state.player);
  const xpPercent = Math.min(100, Math.round((player.xp / player.xp_to_next) * 100));

  return (
    <header className="pointer-events-auto absolute top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-slate-900/85 px-2 py-1.5 text-slate-100 shadow-lg backdrop-blur">
      <Stat icon={<Coins className="size-4 text-amber-300" />} label="Altın">
        {player.coins.toLocaleString("tr-TR")}
      </Stat>

      <Divider />

      <Stat icon={<Zap className="size-4 text-sky-300" />} label="Enerji">
        {player.energy}
        <span className="text-slate-400">/{player.energy_max}</span>
      </Stat>

      <Divider />

      <div className="flex items-center gap-2 px-3 py-1">
        <Star className="size-4 text-violet-300" />
        <div className="flex flex-col gap-1">
          <span className="text-sm leading-none font-semibold tabular-nums">
            Seviye {player.level}
          </span>
          <div
            className="h-1 w-24 overflow-hidden rounded-full bg-slate-700"
            title={`${player.xp} / ${player.xp_to_next} XP`}
          >
            <div className="h-full rounded-full bg-violet-400" style={{ width: `${xpPercent}%` }} />
          </div>
        </div>
      </div>
    </header>
  );
}

function Stat({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1" title={label}>
      {icon}
      <span className="text-sm font-semibold tabular-nums">{children}</span>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="h-6 w-px bg-white/15" />;
}
