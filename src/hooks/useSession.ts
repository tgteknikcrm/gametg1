"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { getSupabase, hasSupabaseEnv } from "@/lib/supabase/client";
import { useWorldStore } from "@/store/useWorldStore";

export type SessionStatus = "loading" | "signed-in" | "signed-out" | "no-config";

export interface SessionState {
  status: SessionStatus;
  userId: string | null;
}

/**
 * Oturum durumunu izler ve kullanıcı kimliğini dünya izdüşümüne yazar.
 * Oturum tarayıcıda localStorage'da tutulur, jeton otomatik yenilenir.
 */
export function useSession(): SessionState {
  const client = useQueryClient();
  const [state, setState] = useState<SessionState>({
    status: hasSupabaseEnv() ? "loading" : "no-config",
    userId: null,
  });

  useEffect(() => {
    if (!hasSupabaseEnv()) return;

    const supabase = getSupabase();
    let active = true;

    const apply = (userId: string | null) => {
      if (!active) return;
      const world = useWorldStore.getState();
      world.setUserId(userId);

      // Çıkışta HER ŞEYİ boşalt. Aynı tarayıcıda ikinci bir oyuncu giriş
      // yaptığında öncekinin ambarını, altınını veya şehrini bir kare bile
      // görmemeli — önbellek de izdüşüm de temizleniyor.
      if (!userId) {
        world.setProfile(null);
        world.setObjects([], 0);
        world.setInventory([]);
        world.setStorage([]);
        client.clear();
      }

      setState({ status: userId ? "signed-in" : "signed-out", userId });
    };

    void supabase.auth.getSession().then(({ data }) => apply(data.session?.user.id ?? null));

    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      apply(session?.user.id ?? null),
    );

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  return state;
}
