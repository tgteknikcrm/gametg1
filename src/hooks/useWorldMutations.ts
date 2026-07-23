"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { toGameErrorMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/queries";
import { getSupabase } from "@/lib/supabase/client";
import { useGameStore } from "@/store/useGameStore";
import { getObjectType, useWorldStore } from "@/store/useWorldStore";
import type { GridCell, Profile, Rotation, WorldObject } from "@/types/game";

interface Snapshot {
  world?: WorldObject[];
  profile?: Profile;
}

let optimisticCounter = 0;

/** Sunucu yanıtı gelene kadar sahnede duracak geçici nesne. */
function optimisticObject(
  userId: string,
  typeId: string,
  origin: GridCell,
  rotation: Rotation,
): WorldObject {
  const type = getObjectType(typeId);
  return {
    id: `optimistic-${++optimisticCounter}`,
    owner_id: userId,
    type_id: typeId,
    local_x: origin.x,
    local_y: origin.y,
    rotation,
    state: type && type.build_seconds > 0 ? "building" : "idle",
    state_since: new Date().toISOString(),
  };
}

function snapshot(client: QueryClient, userId: string | null): Snapshot {
  return {
    world: client.getQueryData<WorldObject[]>(queryKeys.world),
    profile: client.getQueryData<Profile>(queryKeys.profile(userId)),
  };
}

function rollback(client: QueryClient, userId: string | null, previous: Snapshot | undefined) {
  if (previous?.world) client.setQueryData(queryKeys.world, previous.world);
  if (previous?.profile) client.setQueryData(queryKeys.profile(userId), previous.profile);
}

/**
 * Mutasyonlar. Hepsi `supabase.rpc()` — istemci yalnızca tanımlayıcı gönderir,
 * fiyatı ve ayak izini sunucu hesaplar.
 *
 * İyimser güncelleme: önbellek anında güncellenir, RPC hata verirse eski hâline
 * geri döner ve kullanıcıya sunucunun verdiği hata kodu Türkçe gösterilir.
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
      const previous = snapshot(client, userId);
      const type = getObjectType(input.typeId);

      if (previous.world && userId) {
        client.setQueryData<WorldObject[]>(queryKeys.world, [
          ...previous.world,
          optimisticObject(userId, input.typeId, input.origin, input.rotation),
        ]);
      }
      if (previous.profile && type) {
        client.setQueryData<Profile>(queryKeys.profile(userId), {
          ...previous.profile,
          coins: previous.profile.coins - type.cost,
          xp: previous.profile.xp + type.xp_reward,
        });
      }
      return previous;
    },
    onError: (error, _input, previous) => {
      rollback(client, userId, previous);
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
      const previous = snapshot(client, userId);
      if (previous.world) {
        client.setQueryData<WorldObject[]>(
          queryKeys.world,
          previous.world.map((object) =>
            object.id === input.objectId
              ? { ...object, local_x: input.origin.x, local_y: input.origin.y, rotation: input.rotation }
              : object,
          ),
        );
      }
      return previous;
    },
    onError: (error, _input, previous) => {
      rollback(client, userId, previous);
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
      const previous = snapshot(client, userId);
      const type = useWorldStore.getState().typeOf(objectId);

      if (previous.world) {
        client.setQueryData<WorldObject[]>(
          queryKeys.world,
          previous.world.filter((object) => object.id !== objectId),
        );
      }
      if (previous.profile && type) {
        client.setQueryData<Profile>(queryKeys.profile(userId), {
          ...previous.profile,
          coins: previous.profile.coins + Math.floor(type.cost * type.refund_rate),
        });
      }
      return previous;
    },
    onError: (error, _objectId, previous) => {
      rollback(client, userId, previous);
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
