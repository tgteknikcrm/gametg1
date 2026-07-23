"use client";

import { Hammer } from "lucide-react";
import { useCallback, useMemo } from "react";

import { ObjectCard } from "@/components/ui-game/ObjectCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/categories";
import { useGameStore } from "@/store/useGameStore";
import { useWorldStore } from "@/store/useWorldStore";
import type { ObjectCategory, ObjectType } from "@/types/game";

/**
 * Sol panel: kategori sekmeleri ve nesne kartları.
 * Kartların kaynağı `object_types` tablosu — fiyat/seviye bilgisi sunucudan gelir.
 */
export function BuildSidebar() {
  const placingTypeId = useGameStore((state) => state.placingTypeId);
  const startPlacing = useGameStore((state) => state.startPlacing);
  const catalog = useWorldStore((state) => state.catalog);
  const coins = useWorldStore((state) => state.profile?.coins ?? 0);
  const level = useWorldStore((state) => state.profile?.level ?? 1);

  const byCategory = useMemo(() => {
    const groups = {} as Record<ObjectCategory, ObjectType[]>;
    for (const category of CATEGORY_ORDER) groups[category] = [];
    for (const type of catalog) groups[type.category]?.push(type);
    return groups;
  }, [catalog]);

  const handleSelect = useCallback(
    (typeId: string) => {
      // Aynı karta tekrar basmak yerleştirme modundan çıkarır.
      if (useGameStore.getState().placingTypeId === typeId) {
        useGameStore.getState().cancel();
        return;
      }
      startPlacing(typeId);
    },
    [startPlacing],
  );

  return (
    <aside className="pointer-events-auto absolute top-4 left-4 z-20 flex h-[calc(100vh-2rem)] w-[300px] flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900/85 text-slate-100 shadow-xl backdrop-blur">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Hammer className="size-4 text-emerald-300" />
        <h1 className="text-sm font-semibold tracking-wide">İnşaat</h1>
      </div>

      <Tabs defaultValue={CATEGORY_ORDER[0]} className="min-h-0 flex-1 gap-0">
        <TabsList className="mx-3 mt-3 grid w-auto grid-cols-4 bg-slate-800/80">
          {CATEGORY_ORDER.map((category) => (
            <TabsTrigger key={category} value={category} className="text-xs">
              {CATEGORY_LABELS[category]}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORY_ORDER.map((category) => (
          <TabsContent key={category} value={category} className="min-h-0 overflow-y-auto p-3">
            <div className="flex flex-col gap-2">
              {byCategory[category].map((type) => (
                <ObjectCard
                  key={type.id}
                  type={type}
                  selected={placingTypeId === type.id}
                  affordable={coins >= type.cost}
                  unlocked={level >= type.level_required}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </aside>
  );
}
