"use client";

import { AuthForm } from "@/components/auth/AuthForm";
import { useSession } from "@/hooks/useSession";

/** Oturum yoksa giriş formunu, varsa oyunu gösterir. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const session = useSession();

  if (session.status === "no-config") return <MissingConfig />;
  if (session.status === "loading") return <Splash text="Oturum kontrol ediliyor…" />;
  if (session.status === "signed-out") return <AuthForm />;

  return <>{children}</>;
}

function Splash({ text }: { text: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-400">
      {text}
    </div>
  );
}

function MissingConfig() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 p-6">
      <div className="max-w-md rounded-2xl border border-amber-400/30 bg-slate-900 p-6 text-sm text-slate-300">
        <h1 className="mb-3 text-base font-semibold text-amber-300">Supabase yapılandırılmamış</h1>
        <p className="mb-4">
          Proje kökünde <code className="text-slate-100">.env.local</code> dosyası oluştur ve şu iki
          değeri gir:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
{`NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-anahtari>`}
        </pre>
        <p className="mt-4 text-xs text-slate-500">
          Supabase panelinde: Project Settings → API. Sonra sunucuyu yeniden başlat.
        </p>
      </div>
    </div>
  );
}
