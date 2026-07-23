"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { toGameErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/queries";
import { getSupabase } from "@/lib/supabase/client";
import { useGameStore } from "@/store/useGameStore";
import { useWorldStore } from "@/store/useWorldStore";

/** Sunucudan dönen mal adlarını okunur yaz: "10 Buğday, 5 Un". */
function describeItems(items: Record<string, number>): string {
  const byId = useWorldStore.getState().itemsById;
  return Object.entries(items)
    .map(([id, qty]) => `${qty} ${byId.get(id)?.name ?? id}`)
    .join(", ");
}

/**
 * Üretim, yükseltme, pazar ve elmas mutasyonları.
 *
 * Üretim artık tıklamayla başlatılmıyor: binalar inşaat biter bitmez kesintisiz
 * üretir, biriken mal `collect_all` ile envantere geçer. `useProductionClock`
 * bunu bir tur dolduğunda kendiliğinden çağırır.
 */
export function useProductionMutations() {
  const client = useQueryClient();
  const userId = useWorldStore((state) => state.userId);
  const notify = useGameStore((state) => state.notify);

  const invalidateAll = () => {
    void client.invalidateQueries({ queryKey: queryKeys.world });
    void client.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    void client.invalidateQueries({ queryKey: queryKeys.inventory(userId) });
    void client.invalidateQueries({ queryKey: queryKeys.storage(userId) });
  };

  const collect = useMutation({
    // Değişken `silent` bayrağı taşır (otomatik toplamada sessiz kal);
    // RPC'nin kendisi parametre almıyor, bayrak yalnızca onSuccess'te okunuyor.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mutationFn: async (silent: boolean) => {
      const { data, error } = await getSupabase().rpc("collect_all");
      if (error) throw error;
      return data?.[0];
    },
    onError: (error) => notify(toGameErrorMessage(error), "error"),
    onSuccess: (result, silent) => {
      if (!result) return;
      if (result.collected === 0) {
        if (!silent) notify("Toplanacak ürün yok", "error");
        return;
      }
      const items = describeItems((result.items ?? {}) as Record<string, number>);
      notify(
        result.blocked_full ? `${items} · depo doldu!` : `+${items}`,
        result.blocked_full ? "error" : "success",
      );
    },
    onSettled: invalidateAll,
  });

  const upgrade = useMutation({
    mutationFn: async (objectId: string) => {
      const { error } = await getSupabase().rpc("upgrade_object", { p_object_id: objectId });
      if (error) throw error;
    },
    onError: (error) => notify(toGameErrorMessage(error), "error"),
    onSuccess: () => notify("Yükseltme başladı", "success"),
    onSettled: invalidateAll,
  });

  const rush = useMutation({
    mutationFn: async (objectId: string) => {
      const { data, error } = await getSupabase().rpc("rush_object", { p_object_id: objectId });
      if (error) throw error;
      return data as number;
    },
    onError: (error) => notify(toGameErrorMessage(error), "error"),
    onSuccess: (gems) => notify(`Anında bitti · −${gems} elmas`, "success"),
    onSettled: invalidateAll,
  });

  const sell = useMutation({
    mutationFn: async (input: { itemId: string; quantity: number }) => {
      const { data, error } = await getSupabase().rpc("sell_item", {
        p_item_id: input.itemId,
        p_quantity: input.quantity,
      });
      if (error) throw error;
      return data as number;
    },
    onError: (error) => notify(toGameErrorMessage(error), "error"),
    onSuccess: (coins) => notify(`+${coins.toLocaleString("tr-TR")} altın`, "success"),
    onSettled: invalidateAll,
  });

  const buy = useMutation({
    mutationFn: async (input: { itemId: string; quantity: number }) => {
      const { data, error } = await getSupabase().rpc("buy_item", {
        p_item_id: input.itemId,
        p_quantity: input.quantity,
      });
      if (error) throw error;
      return data as number;
    },
    onError: (error) => notify(toGameErrorMessage(error), "error"),
    onSuccess: (coins) => notify(`−${coins.toLocaleString("tr-TR")} altın`, "success"),
    onSettled: invalidateAll,
  });

  return useMemo(
    () => ({
      /** `silent` = otomatik toplama; sonuç yoksa kullanıcıyı rahatsız etme. */
      collectAll: (silent = false) => collect.mutate(silent),
      upgrade: (objectId: string) => upgrade.mutate(objectId),
      rush: (objectId: string) => rush.mutate(objectId),
      sell: (itemId: string, quantity: number) => sell.mutate({ itemId, quantity }),
      buy: (itemId: string, quantity: number) => buy.mutate({ itemId, quantity }),
      isBusy: collect.isPending || upgrade.isPending || rush.isPending,
    }),
    [collect, upgrade, rush, sell, buy],
  );
}

export type ProductionMutations = ReturnType<typeof useProductionMutations>;
