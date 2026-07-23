"use client";

import { Hammer, Loader2, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { getSupabase } from "@/lib/supabase/client";

/** Supabase İngilizce döner; kullanıcıya Türkçe gösteriyoruz. */
function authErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return "E-posta veya şifre hatalı";
  if (/already registered|already exists/i.test(message)) return "Bu e-posta zaten kayıtlı";
  if (/password should be at least/i.test(message)) return "Şifre en az 6 karakter olmalı";
  if (/invalid format|unable to validate email/i.test(message)) return "Geçersiz e-posta adresi";
  if (/rate limit|too many/i.test(message)) return "Çok fazla deneme, biraz bekle";
  if (/fetch|network/i.test(message)) return "Sunucuya ulaşılamadı";
  return "Giriş yapılamadı, tekrar dene";
}

const FIELD =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-emerald-400/50 focus:bg-white/[0.07]";

export function AuthForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = getSupabase();
    const credentials = { email: email.trim(), password };
    const { error: authError } = isSignUp
      ? await supabase.auth.signUp({
          ...credentials,
          options: { data: { username: credentials.email.split("@")[0] } },
        })
      : await supabase.auth.signInWithPassword(credentials);

    if (authError) {
      setError(authErrorMessage(authError.message));
      setBusy(false);
    }
    // Başarılıysa onAuthStateChange devralır; bu bileşen zaten kaldırılacak.
  };

  return (
    <div
      className="grid min-h-screen place-items-center p-6"
      style={{ background: "linear-gradient(180deg, #0e1526, #0a1020 60%, #0d1a2a)" }}
    >
      <form onSubmit={submit} className="hud-card w-full max-w-[380px] p-7">
        <span className="mb-5 grid size-11 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25">
          <Hammer className="size-5" />
        </span>

        <h1 className="text-xl leading-tight font-semibold text-slate-50">Şehir Simülatörü</h1>
        <p className="mt-1.5 mb-6 text-[13px] text-slate-400">
          {isSignUp
            ? "Hesabını oluştur ve paylaşılan şehre katıl."
            : "Şehre dönmek için giriş yap."}
        </p>

        <label className="block text-[11px] font-medium tracking-wide text-slate-400 uppercase" htmlFor="email">
          E-posta
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="ornek@eposta.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={FIELD}
        />

        <label
          className="mt-4 block text-[11px] font-medium tracking-wide text-slate-400 uppercase"
          htmlFor="password"
        >
          Şifre
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          placeholder="en az 6 karakter"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={FIELD}
        />

        {error && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-rose-500/12 px-3 py-2.5 text-xs text-rose-200 ring-1 ring-rose-400/25">
            <TriangleAlert className="size-3.5 shrink-0" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {isSignUp ? "Hesap oluştur" : "Giriş yap"}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsSignUp((value) => !value);
            setError(null);
          }}
          className="mt-4 w-full text-center text-xs text-slate-500 transition-colors hover:text-slate-300"
        >
          {isSignUp ? "Zaten hesabım var — giriş yap" : "Hesabım yok — kayıt ol"}
        </button>
      </form>
    </div>
  );
}
