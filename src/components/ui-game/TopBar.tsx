"use client";

import { Coins, LogOut, Zap } from "lucide-react";

import { getSupabase } from "@/lib/supabase/client";
import { useWorldStore } from "@/store/useWorldStore";

/**
 * Sağ üstte iki yüzen kart: kaynak göstergeleri ve oyuncu künyesi.
 * Değerler `profiles` satırından gelir.
 */
export function TopBar() {
  const profile = useWorldStore((state) => state.profile);

  const coins = profile?.coins ?? 0;
  const level = profile?.level ?? 1;
  const xp = profile?.xp ?? 0;
  const energy = profile?.energy ?? 0;
  const username = profile?.username ?? "…";

  return (
    <header className="pointer-events-auto absolute top-5 right-5 z-20 flex items-stretch gap-2.5">
      <div className="hud-card flex items-center gap-1 px-1.5 py-1.5">
        <Resource
          icon={<Coins className="size-3.5" />}
          tint="text-amber-300 bg-amber-400/12 ring-amber-400/25"
          label="Altın"
          value={coins.toLocaleString("tr-TR")}
        />
        <Resource
          icon={<Zap className="size-3.5" />}
          tint="text-sky-300 bg-sky-400/12 ring-sky-400/25"
          label="Enerji"
          value={String(energy)}
        />
      </div>

      <div className="hud-card flex items-center gap-2.5 py-1.5 pr-1.5 pl-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-400/15 text-[13px] font-bold text-violet-200 ring-1 ring-violet-400/25">
          {level}
        </span>

        <div className="min-w-0">
          <p className="max-w-28 truncate text-[13px] leading-tight font-semibold text-slate-50">
            {username}
          </p>
          <p className="text-[11px] leading-tight text-slate-400 tabular-nums">{xp} XP</p>
        </div>

        <button
          type="button"
          onClick={() => void getSupabase().auth.signOut()}
          title="Çıkış yap"
          aria-label="Çıkış yap"
          className="grid size-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
}

function Resource({
  icon,
  tint,
  label,
  value,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-2 py-1" title={label}>
      <span className={`grid size-7 place-items-center rounded-lg ring-1 ${tint}`}>{icon}</span>
      <span className="pr-1 text-[13px] font-semibold text-slate-50 tabular-nums">{value}</span>
    </div>
  );
}
