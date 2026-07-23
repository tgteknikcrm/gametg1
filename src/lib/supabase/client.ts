import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type GameSupabaseClient = SupabaseClient<Database>;

let cached: GameSupabaseClient | null = null;

/** Ortam değişkenleri tanımlı mı? Eksikse arayüz kurulum yönergesi gösterir. */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Tarayıcı istemcisi (tekil).
 *
 * Anon anahtar gizli değildir; veriyi koruyan şey RLS ve SECURITY DEFINER
 * fonksiyonlardır. Bu istemci yalnızca `select` ve `rpc` çağırır — hiçbir yerde
 * doğrudan insert/update/delete yok, zaten veritabanı da izin vermiyor.
 *
 * Modül yüklenirken değil ilk kullanımda kuruluyor: build sırasında ortam
 * değişkeni yoksa derleme patlamasın, çalışma zamanında anlaşılır hata versin.
 */
export function getSupabase(): GameSupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("supabase_env_missing");
  }

  cached = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return cached;
}
