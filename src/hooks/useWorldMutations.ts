"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { toGameErrorMessage } from "@/lib/errors";
import { queryKeys, type WorldSnapshot } from "@/lib/queries";
import { getSupabase } from "@/lib/supabase/client";
import { useGameStore } from "@/store/useGameStore";
import { getObjectType, useWorldStore } from "@/store/useWorldStore";
import type { GridCell, Rotation, WorldObject } from "@/types/game";

let optimisticCounter = 0;

/** Sunucu yanıtı gelene kadar sahnede duracak geçici nesne. */
function optimisticObject(
  userId: string,
  typeId: string,
  origin: GridCell,
  rotation: Rotation,
): WorldObject {
  const type = getObjectType(typeId);
  const buildSeconds = type?.build_seconds ?? 0;
  const isBuilding = buildSeconds > 0;
  const now = new Date();

  return {
    id: `optimistic-${++optimisticCounter}`,
    owner_id: userId,
    type_id: typeId,
    local_x: origin.x,
    local_y: origin.y,
    rotation,
    state: isBuilding ? "building" : "idle",
    state_since: now.toISOString(),
    last_collected_at: null,
    state_duration: buildSeconds,
    effective_state: isBuilding ? "building" : "idle",
    finishes_at: isBuilding ? new Date(now.getTime() + buildSeconds * 1000).toISOString() : null,
    remaining_seconds: isBuilding ? buildSeconds : 0,
    level: 1,
    pending_level: null,
    effective_level: 1,
    cycle_seconds: type?.produce_seconds ?? null,
    cycle_output: type?.output_qty ?? null,
    cycle_input: type?.input_qty ?? null,
    pending_cycles: 0,
    pending_qty: 0,
    cycle_remaining_seconds: type?.produce_seconds ?? null,
  };
}

/**
 * Dünya önbelleğini nesne listesi üzerinden günceller.
 *
 * `fetchedAt` OLDUĞU GİBİ taşınır: geri sayımların çapası odur, iyimser bir
 * yazım yüzünden yenilenirse bütün sayaçlar geri sıçrar.
 */
function patchWorld(
  client: QueryClient,
  update: (objects: WorldObject[]) => WorldObject[],
): void {
  client.setQueryData<WorldSnapshot>(queryKeys.world, (previous) =>
    previous ? { ...previous, objects: update(previous.objects) } : previous,
  );
}

/**
 * Mutasyonlar. Hepsi `supabase.rpc()` — istemci yalnızca tanımlayıcı gönderir,
 * fiyatı ve ayak izini sunucu hesaplar.
 *
 * Geri alma HEDEFLİ: hatada tüm önbellek anlık görüntüsü geri yüklenmez, yalnızca
 * o mutasyonun dokunduğu satır düzeltilir. Zincirleme inşaatta iki mutasyon
 * aynı anda uçtuğunda biri diğerinin iyimser yazımını silmesin diye.
 */
export function useWorldMutations() {
  const client = useQueryClient();
  const userId = useWorldStore((state) => state.userId);
  const notify = useGameStore((state) => state.notify);

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: queryKeys.world });
    void client.invalidateQueries({ queryKey: queryKeys.profile(userId) });
  };

  const place = useMutation({
    mutationFn: async (input: { typeId: string; origin: GridCell; rotation: Rotation }) => {
      const { error } = await getSupabase().rpc("place_object", {
        p_type_id: input.typeId,
        p_x: input.origin.x,
        p_y: input.origin.y,
        p_rotation: input.rotation,
      });
      if (error) throw error;
    },
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: queryKeys.world });
      if (!userId) return { temporaryId: null };

      const temporary = optimisticObject(userId, input.typeId, input.origin, input.rotation);
      patchWorld(client, (objects) => [...objects, temporary]);
      return { temporaryId: temporary.id };
    },
    onError: (error, _input, context) => {
      // Yalnızca bu mutasyonun eklediği satırı geri al.
      if (context?.temporaryId) {
        patchWorld(client, (objects) => objects.filter((o) => o.id !== context.temporaryId));
      }
      notify(toGameErrorMessage(error), "error");
    },
    onSettled: invalidate,
  });

  const move = useMutation({
    mutationFn: async (input: { objectId: string; origin: GridCell; rotation: Rotation }) => {
      const { error } = await getSupabase().rpc("move_object", {
        p_object_id: input.objectId,
        p_x: input.origin.x,
        p_y: input.origin.y,
        p_rotation: input.rotation,
      });
      if (error) throw error;
    },
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: queryKeys.world });
      const before = client
        .getQueryData<WorldSnapshot>(queryKeys.world)
        ?.objects.find((object) => object.id === input.objectId);

      patchWorld(client, (objects) =>
        objects.map((object) =>
          object.id === input.objectId
            ? { ...object, local_x: input.origin.x, local_y: input.origin.y, rotation: input.rotation }
            : object,
        ),
      );
      return { before };
    },
    onError: (error, input, context) => {
      const before = context?.before;
      if (before) {
        patchWorld(client, (objects) =>
          objects.map((object) => (object.id === input.objectId ? before : object)),
        );
      }
      notify(toGameErrorMessage(error), "error");
    },
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (objectId: string) => {
      const { error } = await getSupabase().rpc("remove_object", { p_object_id: objectId });
      if (error) throw error;
    },
    onMutate: async (objectId) => {
      await client.cancelQueries({ queryKey: queryKeys.world });
      const before = client
        .getQueryData<WorldSnapshot>(queryKeys.world)
        ?.objects.find((object) => object.id === objectId);

      patchWorld(client, (objects) => objects.filter((object) => object.id !== objectId));
      return { before };
    },
    onError: (error, _objectId, context) => {
      if (context?.before) {
        const restored = context.before;
        patchWorld(client, (objects) => [...objects, restored]);
      }
      notify(toGameErrorMessage(error), "error");
    },
    onSettled: invalidate,
  });

  return useMemo(
    () => ({
      place: (typeId: string, origin: GridCell, rotation: Rotation) =>
        place.mutate({ typeId, origin, rotation }),
      move: (objectId: string, origin: GridCell, rotation: Rotation) =>
        move.mutate({ objectId, origin, rotation }),
      remove: (objectId: string) => remove.mutate(objectId),
    }),
    [place, move, remove],
  );
}

export type WorldMutations = ReturnType<typeof useWorldMutations>;
