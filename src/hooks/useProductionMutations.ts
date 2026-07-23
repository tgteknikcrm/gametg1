"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { toGameErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/queries";
import { getSupabase } from "@/lib/supabase/client";
import { useGameStore } from "@/store/useGameStore";
import { useWorldStore } from "@/store/useWorldStore";
import type { WorldObject } from "@/types/game";

/** Sunucudan dönen mal adını okunur yaz: "10 Buğday". */
function describeItems(items: Record<string, number>): string {
  const byId = useWorldStore.getState().itemsById;
  return Object.entries(items)
    .map(([id, qty]) => `${qty} ${byId.get(id)?.name ?? id}`)
    .join(", ");
}

/**
 * Üretim ve pazar mutasyonları.
 *
 * Hepsi `supabase.rpc()`. Süre kontrolü sunucuda: istemcinin geri sayımı
 * bitmiş görünse bile `effective_state` kabul etmezse işlem reddedilir.
 *
 * Bu işlemler tıklamayla tetiklenen bilinçli eylemler olduğu için iyimser
 * güncelleme yalnızca durum rozetine uygulanır; miktar ve altın sunucudan
 * doğrulanmış hâliyle gelir.
 */
export function useProductionMutations() {
  const client = useQueryClient();
  const userId = useWorldStore((state) => state.userId);
  const notify = useGameStore((state) => state.notify);

  const invalidateAll = () => {
    void client.invalidateQueries({ queryKey: queryKeys.world });
    void client.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    void client.invalidateQueries({ queryKey: queryKeys.inventory(userId) });
  };

  /** Rozet anında değişsin diye yalnızca durumu iyimser günceller. */
  const patchState = (objectId: string, state: WorldObject["state"]) => {
    const previous = client.getQueryData<WorldObject[]>(queryKeys.world);
    if (!previous) return previous;
    client.setQueryData<WorldObject[]>(
      queryKeys.world,
      previous.map((object) =>
        object.id === objectId
          ? { ...object, state, effective_state: state, remaining_seconds: null }
          : object,
      ),
    );
    return previous;
  };

  const rollback = (previous: WorldObject[] | undefined) => {
    if (previous) client.setQueryData(queryKeys.world, previous);
  };

  const start = useMutation({
    mutationFn: async (objectId: string) => {
      const { error } = await getSupabase().rpc("start_production", { p_object_id: objectId });
      if (error) throw error;
    },
    onMutate: (objectId) => patchState(objectId, "producing"),
    onError: (error, _id, previous) => {
      rollback(previous);
      notify(toGameErrorMessage(error), "error");
    },
    onSuccess: () => notify("Üretim başladı", "success"),
    onSettled: invalidateAll,
  });

  const harvest = useMutation({
    mutationFn: async (objectId: string) => {
      const { data, error } = await getSupabase().rpc("harvest_object", { p_object_id: objectId });
      if (error) throw error;
      return data?.[0];
    },
    onMutate: (objectId) => patchState(objectId, "idle"),
    onError: (error, _id, previous) => {
      rollback(previous);
      notify(toGameErrorMessage(error), "error");
    },
    onSuccess: (result) => {
      if (!result) return;
      const name = useWorldStore.getState().itemsById.get(result.item_id)?.name ?? result.item_id;
      notify(`+${result.quantity} ${name}`, "success");
    },
    onSettled: invalidateAll,
  });

  const harvestAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabase().rpc("harvest_all");
      if (error) throw error;
      return data?.[0];
    },
    onError: (error) => notify(toGameErrorMessage(error), "error"),
    onSuccess: (result) => {
      if (!result || result.harvested === 0) {
        notify("Hasada hazır bina yok", "error");
        return;
      }
      const items = describeItems((result.items ?? {}) as Record<string, number>);
      notify(`${result.harvested} bina toplandı · ${items}`, "success");
    },
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
      startProduction: (objectId: string) => start.mutate(objectId),
      harvest: (objectId: string) => harvest.mutate(objectId),
      harvestAll: () => harvestAll.mutate(),
      sell: (itemId: string, quantity: number) => sell.mutate({ itemId, quantity }),
      buy: (itemId: string, quantity: number) => buy.mutate({ itemId, quantity }),
      isBusy: start.isPending || harvest.isPending || harvestAll.isPending,
    }),
    [start, harvest, harvestAll, sell, buy],
  );
}

export type ProductionMutations = ReturnType<typeof useProductionMutations>;
