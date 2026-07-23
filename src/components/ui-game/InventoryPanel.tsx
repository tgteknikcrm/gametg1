"use client";

import { ChevronDown, Coins, Package, ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";

import { useProductionMutations } from "@/hooks/useProductionMutations";
import { cn } from "@/lib/utils";
import { useWorldStore } from "@/store/useWorldStore";

/**
 * Ambar ve NPC pazarı.
 *
 * Fiyatlar `items` tablosundan gelir; istemci yalnızca mal kimliği ve miktar
 * gönderir. Alış ve satış fiyatı arasındaki fark bilinçli bir para çıkışıdır
 * (brief madde 4) — bu yüzden ikisi de ayrı ayrı gösteriliyor.
 */
export function InventoryPanel() {
  const [open, setOpen] = useState(true);
  const items = useWorldStore((state) => state.items);
  const inventory = useWorldStore((state) => state.inventory);
  const production = useProductionMutations();

  const rows = useMemo(
    () => items.map((item) => ({ item, quantity: inventory.get(item.id) ?? 0 })),
    [items, inventory],
  );

  const owned = rows.filter((row) => row.quantity > 0);
  const totalValue = owned.reduce((sum, row) => sum + row.quantity * row.item.npc_buy_price, 0);

  return (
    <section className="hud-card pointer-events-auto absolute bottom-5 left-5 z-20 w-[336px] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-white/5"
      >
        <span className="grid size-8 place-items-center rounded-lg bg-amber-400/12 text-amber-300 ring-1 ring-amber-400/25">
          <Package className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-tight font-semibold text-slate-50">Ambar</span>
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            {owned.length === 0 ? (
              "boş"
            ) : (
              <>
                {owned.length} çeşit · değeri
                <Coins className="size-2.5" />
                <span className="tabular-nums">{totalValue.toLocaleString("tr-TR")}</span>
              </>
            )}
          </span>
        </span>
        <ChevronDown
          className={cn("size-4 text-slate-500 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="max-h-[34vh] overflow-y-auto px-3.5 pb-3.5">
          <div className="flex flex-col gap-1.5">
            {rows.map(({ item, quantity }) => (
              <div
                key={item.id}
                className={cn(
                  "hud-inset flex items-center gap-2.5 px-2.5 py-2",
                  quantity === 0 && "opacity-45",
                )}
              >
                <span
                  aria-hidden
                  className="size-6 shrink-0 rounded-md border border-black/25"
                  style={{ backgroundColor: item.color }}
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-slate-100">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-slate-500 tabular-nums">
                    sat {item.npc_buy_price} · al {item.npc_sell_price}
                  </span>
                </span>

                <span className="w-8 text-right text-[13px] font-semibold text-slate-100 tabular-nums">
                  {quantity}
                </span>

                <span className="flex gap-1">
                  <button
                    type="button"
                    disabled={quantity === 0}
                    onClick={() => production.sell(item.id, quantity)}
                    title={`Tümünü sat (+${(quantity * item.npc_buy_price).toLocaleString("tr-TR")} altın)`}
                    className="rounded-lg bg-emerald-400/15 px-2 py-1 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-400/25 transition-colors hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Sat
                  </button>
                  <button
                    type="button"
                    onClick={() => production.buy(item.id, 10)}
                    title={`10 adet al (−${(10 * item.npc_sell_price).toLocaleString("tr-TR")} altın)`}
                    className="grid size-[26px] place-items-center rounded-lg bg-white/6 text-slate-400 ring-1 ring-white/10 transition-colors hover:bg-white/12 hover:text-slate-200"
                  >
                    <ShoppingCart className="size-3" />
                  </button>
                </span>
              </div>
            ))}
          </div>

          <p className="mt-2.5 text-[10px] leading-relaxed text-slate-500">
            NPC her malı satış fiyatından satar, alış fiyatından alır. Aradaki fark şehirden
            para çıkışıdır.
          </p>
        </div>
      )}
    </section>
  );
}
