"use client";

import { Loader2 } from "lucide-react";
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
    <div className="grid min-h-screen place-items-center bg-slate-950 p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
      >
        <h1 className="text-lg font-semibold text-slate-100">Şehir Simülatörü</h1>
        <p className="mt-1 mb-6 text-sm text-slate-400">
          {isSignUp ? "Yeni hesap oluştur ve şehre katıl." : "Şehre dönmek için giriş yap."}
        </p>

        <label className="block text-xs font-medium text-slate-300" htmlFor="email">
          E-posta
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 mb-4 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400/60"
        />

        <label className="block text-xs font-medium text-slate-300" htmlFor="password">
          Şifre
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400/60"
        />

        {error && (
          <p className="mt-4 rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-200">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
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
          className="mt-4 w-full text-center text-xs text-slate-400 transition-colors hover:text-slate-200"
        >
          {isSignUp ? "Zaten hesabım var — giriş yap" : "Hesabım yok — kayıt ol"}
        </button>
      </form>
    </div>
  );
}
