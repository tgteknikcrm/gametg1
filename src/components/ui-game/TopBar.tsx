"use client";

import { Coins, LogOut, Star, Zap } from "lucide-react";

import { getSupabase } from "@/lib/supabase/client";
import { useWorldStore } from "@/store/useWorldStore";

/** Üst bar: altın, enerji, seviye. Değerler `profiles` satırından gelir. */
export function TopBar() {
  const profile = useWorldStore((state) => state.profile);

  const coins = profile?.coins ?? 0;
  const level = profile?.level ?? 1;
  const xp = profile?.xp ?? 0;
  const energy = profile?.energy ?? 0;

  return (
    <header className="pointer-events-auto absolute top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-slate-900/85 px-2 py-1.5 text-slate-100 shadow-lg backdrop-blur">
      <Stat icon={<Coins className="size-4 text-amber-300" />} label="Altın">
        {coins.toLocaleString("tr-TR")}
      </Stat>

      <Divider />

      <Stat icon={<Zap className="size-4 text-sky-300" />} label="Enerji">
        {energy}
      </Stat>

      <Divider />

      <div className="flex items-center gap-2 px-3 py-1">
        <Star className="size-4 text-violet-300" />
        <span className="text-sm leading-none font-semibold tabular-nums">
          Seviye {level}
          <span className="ml-1.5 text-xs font-normal text-slate-400">{xp} XP</span>
        </span>
      </div>

      <Divider />

      <div className="flex items-center gap-2 px-3 py-1">
        <span className="max-w-32 truncate text-sm text-slate-300">
          {profile?.username ?? "…"}
        </span>
        <button
          type="button"
          onClick={() => void getSupabase().auth.signOut()}
          title="Çıkış yap"
          aria-label="Çıkış yap"
          className="rounded p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100"
        >
          <LogOut className="size-4" />
        </button>
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
