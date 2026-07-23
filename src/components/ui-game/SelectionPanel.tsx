"use client";

import { Move, Trash2, X } from "lucide-react";

import { CATEGORY_LABELS, getObjectType } from "@/lib/catalog";
import { rotatedFootprint } from "@/lib/grid";
import { useGameStore } from "@/store/useGameStore";
import { useWorldStore } from "@/store/useWorldStore";

/** Seçili nesnenin künyesi ve eylemleri. `navigate` modunda görünür. */
export function SelectionPanel() {
  const mode = useGameStore((state) => state.mode);
  const selectedObjectId = useGameStore((state) => state.selectedObjectId);
  const object = useWorldStore((state) =>
    state.objects.find((candidate) => candidate.id === selectedObjectId),
  );

  const type = getObjectType(object?.type_id ?? null);
  if (!object || !type || mode !== "navigate") return null;

  const { w, h } = rotatedFootprint(type.width, type.height, object.rotation);

  const handleRemove = () => {
    useWorldStore.getState().removeObject(object.id);
    useGameStore.getState().selectObject(null);
    useGameStore.getState().notify("Nesne kaldırıldı", "success");
  };

  return (
    <section className="pointer-events-auto absolute right-4 bottom-4 z-20 w-[280px] overflow-hidden rounded-xl border border-white/10 bg-slate-900/90 text-slate-100 shadow-xl backdrop-blur">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <span
          aria-hidden
          className="size-8 shrink-0 rounded-md border border-black/20"
          style={{ backgroundColor: type.color }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{type.name}</p>
          <p className="text-xs text-slate-400">{CATEGORY_LABELS[type.category]}</p>
        </div>
        <button
          type="button"
          onClick={() => useGameStore.getState().selectObject(null)}
          className="rounded p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100"
          aria-label="Kapat"
        >
          <X className="size-4" />
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-4 py-3 text-xs">
        <Row label="Konum">
          {object.local_x}, {object.local_y}
        </Row>
        <Row label="Ayak izi">
          {w}×{h}
        </Row>
        <Row label="Yön">{object.rotation}°</Row>
        <Row label="Durum">{object.state}</Row>
        {type.worker_slots > 0 && <Row label="İşçi yeri">{type.worker_slots}</Row>}
        {type.population_capacity > 0 && <Row label="Nüfus">{type.population_capacity}</Row>}
      </dl>

      <div className="flex gap-2 border-t border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={() => useGameStore.getState().startMoving(object.id)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-500/90 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-400"
        >
          <Move className="size-3.5" />
          Taşı
        </button>
        <button
          type="button"
          onClick={handleRemove}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-rose-500/85 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-400"
        >
          <Trash2 className="size-3.5" />
          Kaldır
        </button>
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{children}</dd>
    </>
  );
}
