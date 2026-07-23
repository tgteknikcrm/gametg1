"use client";

import { Coins, Gem, Wheat, Boxes } from "lucide-react";

import { cn } from "@/lib/utils";
import { useWorldStore } from "@/store/useWorldStore";
import type { StorageClass } from "@/types/game";

/**
 * Üst kaynak şeridi: üretilen malların anlık miktarı, ambar doluluğu,
 * altın ve elmas. Oyuncunun binaları tek tek açmasına gerek kalmasın diye.
 */
export function ResourceBar() {
  const items = useWorldStore((state) => state.items);
  const inventory = useWorldStore((state) => state.inventory);
  const storage = useWorldStore((state) => state.storage);
  const coins = useWorldStore((state) => state.profile?.coins ?? 0);
  const gems = useWorldStore((state) => state.profile?.gems ?? 0);

  return (
    <header className="pointer-events-auto absolute top-5 left-1/2 z-20 flex max-w-[calc(100vw-760px)] -translate-x-1/2 items-stretch gap-2.5">
      <div className="hud-card flex items-center gap-0.5 px-1.5 py-1.5">
        <Currency icon={<Coins className="size-3.5" />} tint="text-amber-300 bg-amber-400/12 ring-amber-400/25" value={coins} label="Altın" />
        <Currency icon={<Gem className="size-3.5" />} tint="text-cyan-300 bg-cyan-400/12 ring-cyan-400/25" value={gems} label="Elmas" />
      </div>

      <div className="hud-card flex min-w-0 items-center gap-1 overflow-x-auto px-2 py-1.5">
        {items.map((item) => (
          <span
            key={item.id}
            title={`${item.name} — sat ${item.npc_buy_price}, al ${item.npc_sell_price}`}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1"
          >
            <span
              aria-hidden
              className="size-4 shrink-0 rounded border border-black/30"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[12px] font-semibold text-slate-100 tabular-nums">
              {(inventory.get(item.id) ?? 0).toLocaleString("tr-TR")}
            </span>
          </span>
        ))}
      </div>

      <div className="hud-card flex items-center gap-2.5 px-3 py-1.5">
        <Silo icon={<Wheat className="size-3.5" />} cls="grain" label="Tahıl ambarı" storage={storage} />
        <Silo icon={<Boxes className="size-3.5" />} cls="goods" label="Depo" storage={storage} />
      </div>
    </header>
  );
}

function Currency({
  icon,
  tint,
  value,
  label,
}: {
  icon: React.ReactNode;
  tint: string;
  value: number;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2 rounded-xl px-2 py-1" title={label}>
      <span className={`grid size-7 place-items-center rounded-lg ring-1 ${tint}`}>{icon}</span>
      <span className="pr-1 text-[13px] font-semibold text-slate-50 tabular-nums">
        {value.toLocaleString("tr-TR")}
      </span>
    </span>
  );
}

function Silo({
  icon,
  cls,
  label,
  storage,
}: {
  icon: React.ReactNode;
  cls: StorageClass;
  label: string;
  storage: Map<StorageClass, { stored: number; capacity: number }>;
}) {
  const row = storage.get(cls) ?? { stored: 0, capacity: 0 };
  const ratio = row.capacity > 0 ? row.stored / row.capacity : 0;
  const full = ratio >= 0.999;

  return (
    <span className="flex flex-col gap-1" title={`${label}: ${row.stored} / ${row.capacity}`}>
      <span className="flex items-center gap-1.5 text-[11px] leading-none text-slate-300">
        <span className={cn(full ? "text-rose-300" : "text-slate-500")}>{icon}</span>
        <span className="tabular-nums">
          {row.stored}
          <span className="text-slate-500">/{row.capacity}</span>
        </span>
      </span>
      <span className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-500",
            full ? "bg-rose-400" : ratio > 0.8 ? "bg-amber-400" : "bg-emerald-400",
          )}
          style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
        />
      </span>
    </span>
  );
}
