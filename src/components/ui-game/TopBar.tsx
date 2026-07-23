"use client";

import { LogOut, Zap } from "lucide-react";

import { getSupabase } from "@/lib/supabase/client";
import { useWorldStore } from "@/store/useWorldStore";

/**
 * Sağ üstteki oyuncu künyesi: seviye, ad, enerji, çıkış.
 * Kaynaklar ve para birimleri <ResourceBar /> içinde.
 */
export function TopBar() {
  const profile = useWorldStore((state) => state.profile);

  return (
    <div className="hud-card pointer-events-auto absolute top-5 right-5 z-20 flex items-center gap-2.5 py-1.5 pr-1.5 pl-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-400/15 text-[13px] font-bold text-violet-200 ring-1 ring-violet-400/25">
        {profile?.level ?? 1}
      </span>

      <div className="min-w-0">
        <p className="max-w-28 truncate text-[13px] leading-tight font-semibold text-slate-50">
          {profile?.username ?? "…"}
        </p>
        <p className="flex items-center gap-1 text-[11px] leading-tight text-slate-400 tabular-nums">
          <Zap className="size-3 text-sky-300" />
          {profile?.energy ?? 0}
          <span className="text-slate-600">·</span>
          {profile?.xp ?? 0} XP
        </p>
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
  );
}
