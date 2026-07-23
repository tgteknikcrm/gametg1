"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * TanStack Query sağlayıcısı.
 *
 * `retry: 1` — RPC hataları (cell_occupied gibi) iş kuralı hatasıdır, tekrar
 * denemek anlamsız; ağ hatası için tek bir yeniden deneme yeterli.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: true,
            staleTime: 10_000,
          },
          mutations: { retry: 0 },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
