"use client";

import { Hammer } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { ObjectCard } from "@/components/ui-game/ObjectCard";
import { CATEGORY_ICONS, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/useGameStore";
import { useWorldStore } from "@/store/useWorldStore";
import type { ObjectCategory, ObjectType } from "@/types/game";

/**
 * Sol panel: kategori şeridi ve iki sütunlu bina kartları.
 * Kartların kaynağı `object_types` tablosu — fiyat ve seviye bilgisi sunucudan.
 */
export function BuildSidebar() {
  const [category, setCategory] = useState<ObjectCategory>(CATEGORY_ORDER[0]);
  const placingTypeId = useGameStore((state) => state.placingTypeId);
  const startPlacing = useGameStore((state) => state.startPlacing);
  const catalog = useWorldStore((state) => state.catalog);
  const coins = useWorldStore((state) => state.profile?.coins ?? 0);
  const level = useWorldStore((state) => state.profile?.level ?? 1);

  const byCategory = useMemo(() => {
    const groups = {} as Record<ObjectCategory, ObjectType[]>;
    for (const key of CATEGORY_ORDER) groups[key] = [];
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

  const items = byCategory[category] ?? [];

  return (
    // Alt sol köşe Ambar panelinin; inşaat listesi oraya taşmasın diye sınırlı.
    <aside className="hud-card pointer-events-auto absolute top-5 left-5 z-20 flex max-h-[54vh] w-[336px] flex-col overflow-hidden">
      <header className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <span className="grid size-8 place-items-center rounded-lg bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25">
          <Hammer className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm leading-tight font-semibold text-slate-50">İnşaat</h1>
          <p className="text-[11px] text-slate-400">Bir yapı seç, haritaya yerleştir</p>
        </div>
      </header>

      <nav className="hud-inset mx-4 grid grid-cols-4 gap-0.5 p-1">
        {CATEGORY_ORDER.map((key) => {
          const Icon = CATEGORY_ICONS[key];
          const active = key === category;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors",
                active
                  ? "bg-white/12 text-slate-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]"
                  : "text-slate-400 hover:bg-white/6 hover:text-slate-200",
              )}
            >
              <Icon className="size-4" />
              {CATEGORY_LABELS[key]}
            </button>
          );
        })}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="grid grid-cols-2 gap-2.5">
          {items.map((type) => (
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

        {items.length === 0 && (
          <p className="py-8 text-center text-xs text-slate-500">Bu kategoride yapı yok</p>
        )}
      </div>
    </aside>
  );
}
