"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { GRID_SIZE } from "@/lib/grid";
import { fetchCatalog, fetchParcel, fetchProfile, fetchWorld, queryKeys } from "@/lib/queries";
import { useWorldStore } from "@/store/useWorldStore";

/** Denge verisi nadiren değişir; yine de sabit değil — SQL UPDATE beş dakikada yansır. */
const CATALOG_STALE_MS = 5 * 60_000;

/**
 * Sunucu durumunu çeker ve Zustand izdüşümüne yazar.
 *
 * Tek doğruluk kaynağı TanStack Query önbelleği; store yalnızca sahnenin senkron
 * okuyabildiği bir ayna. Yazma buradan başka hiçbir yerde yapılmaz.
 */
export function useWorldSync(userId: string | null) {
  const catalog = useQuery({
    queryKey: queryKeys.catalog,
    queryFn: fetchCatalog,
    staleTime: CATALOG_STALE_MS,
    enabled: Boolean(userId),
  });

  const parcel = useQuery({
    queryKey: queryKeys.parcel,
    queryFn: fetchParcel,
    staleTime: CATALOG_STALE_MS,
    enabled: Boolean(userId),
  });

  const profile = useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: () => fetchProfile(userId as string),
    enabled: Boolean(userId),
  });

  const world = useQuery({
    queryKey: queryKeys.world,
    queryFn: fetchWorld,
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (catalog.data) useWorldStore.getState().setCatalog(catalog.data);
  }, [catalog.data]);

  useEffect(() => {
    if (world.data) useWorldStore.getState().setObjects(world.data);
  }, [world.data]);

  useEffect(() => {
    useWorldStore.getState().setProfile(profile.data ?? null);
  }, [profile.data]);

  useEffect(() => {
    if (!parcel.data) return;
    useWorldStore.getState().setParcel(parcel.data);
    // Faz 1'de grid boyutu istemcide sabit. Faz 3'te parselden okunacak;
    // o güne kadar sunucuyla ayrışırsak sessizce yanlış çizmeyelim.
    if (parcel.data.width !== GRID_SIZE || parcel.data.height !== GRID_SIZE) {
      console.warn(
        `Parsel ölçüsü (${parcel.data.width}x${parcel.data.height}) istemcideki GRID_SIZE=${GRID_SIZE} ile uyuşmuyor.`,
      );
    }
  }, [parcel.data]);

  return {
    isLoading: catalog.isLoading || world.isLoading || profile.isLoading || parcel.isLoading,
    error: catalog.error ?? parcel.error ?? profile.error ?? world.error ?? null,
    isReady: Boolean(catalog.data && world.data && profile.data && parcel.data),
  };
}
