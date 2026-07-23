"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut, RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { isFatalSessionError, toGameErrorCode, toGameErrorMessage } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";

/** Ölümcül oturum hatasında kullanıcıyı bilgilendirip çıkışa götürene kadar beklenen süre. */
const AUTO_SIGN_OUT_MS = 2200;

/**
 * Şehir yüklenemediğinde çıkmaz sokak bırakmayan ekran.
 *
 * Bazı hatalar yeniden denemekle geçmez: jeton geçerli görünürken profil satırı
 * yoksa (kullanıcı silinmişse) tek çözüm yeniden giriştir. Bu durumda oturumu
 * kendimiz kapatıp giriş formuna döneriz — kullanıcı hata ekranında sıkışmaz.
 */
export function LoadFailure({ error }: { error: unknown }) {
  const client = useQueryClient();
  const code = toGameErrorCode(error);
  const fatal = isFatalSessionError(code);

  useEffect(() => {
    if (!fatal) return;
    const timer = window.setTimeout(() => void getSupabase().auth.signOut(), AUTO_SIGN_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [fatal]);

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-slate-950/75 p-6 backdrop-blur-sm">
      <div className="hud-card w-full max-w-sm p-6">
        <span className="mb-4 grid size-10 place-items-center rounded-xl bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/25">
          <TriangleAlert className="size-5" />
        </span>

        <h2 className="text-base font-semibold text-slate-50">Şehir yüklenemedi</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
          {toGameErrorMessage(error)}
          {fatal && <span className="mt-1 block text-slate-500">Giriş ekranına yönlendiriliyorsun…</span>}
        </p>

        <div className="mt-5 flex gap-2">
          {!fatal && (
            <button
              type="button"
              onClick={() => void client.invalidateQueries()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-300"
            >
              <RotateCcw className="size-3.5" />
              Tekrar dene
            </button>
          )}
          <button
            type="button"
            onClick={() => void getSupabase().auth.signOut()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/8 px-3 py-2 text-xs font-semibold text-slate-200 ring-1 ring-white/12 transition-colors hover:bg-white/14"
          >
            <LogOut className="size-3.5" />
            Çıkış yap
          </button>
        </div>
      </div>
    </div>
  );
}
