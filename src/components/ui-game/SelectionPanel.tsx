"use client";

import { Move, Trash2, User, X } from "lucide-react";

import { IsoBlock } from "@/components/ui-game/IsoBlock";
import { ProductionSection } from "@/components/ui-game/ProductionSection";
import { CATEGORY_LABELS } from "@/lib/categories";
import { formatDuration } from "@/lib/duration";
import { rotatedFootprint } from "@/lib/grid";
import { localState } from "@/lib/production";
import { useClockStore } from "@/store/useClockStore";
import { useGameStore } from "@/store/useGameStore";
import { getObjectType, useWorldStore } from "@/store/useWorldStore";

const STATE_LABELS: Record<string, string> = {
  building: "İnşa ediliyor",
  idle: "Boşta",
  producing: "Üretiyor",
  ready: "Hasada hazır",
  needs_workers: "İşçi gerekiyor",
};

/** Seçili nesnenin künyesi, üretim durumu ve eylemleri. */
export function SelectionPanel() {
  const mode = useGameStore((state) => state.mode);
  const selectedObjectId = useGameStore((state) => state.selectedObjectId);
  const now = useClockStore((state) => state.now);
  const syncedAt = useWorldStore((state) => state.syncedAt);
  const userId = useWorldStore((state) => state.userId);
  const object = useWorldStore((state) =>
    state.objects.find((candidate) => candidate.id === selectedObjectId),
  );

  const type = getObjectType(object?.type_id ?? null);
  if (!object || !type || mode !== "navigate") return null;

  const isMine = object.owner_id === userId;
  const { w, h } = rotatedFootprint(type.width, type.height, object.rotation);
  const state = localState(object, syncedAt, now);

  return (
    <section className="hud-card pointer-events-auto absolute right-5 bottom-5 z-20 w-[286px] overflow-hidden">
      <header className="flex items-center gap-3 px-3.5 pt-3.5 pb-3">
        <IsoBlock color={type.color} size={38} tall={type.block_height > 1.6} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-tight font-semibold text-slate-50">{type.name}</p>
          <p className="text-[11px] text-slate-400">{CATEGORY_LABELS[type.category]}</p>
        </div>
        <button
          type="button"
          onClick={() => useGameStore.getState().selectObject(null)}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200"
          aria-label="Kapat"
        >
          <X className="size-4" />
        </button>
      </header>

      <dl className="hud-inset mx-3.5 grid grid-cols-2 gap-x-3 gap-y-1.5 px-3 py-2.5 text-[11px]">
        <Row label="Durum">{STATE_LABELS[state] ?? state}</Row>
        <Row label="Konum">
          {object.local_x}, {object.local_y}
        </Row>
        <Row label="Ayak izi">
          {w}×{h}
        </Row>
        <Row label="Yön">{object.rotation}°</Row>
        {type.produce_seconds !== null && (
          <Row label="Tur süresi">{formatDuration(type.produce_seconds)}</Row>
        )}
        {type.worker_slots > 0 && <Row label="İşçi yeri">{type.worker_slots}</Row>}
        {type.population_capacity > 0 && <Row label="Nüfus">{type.population_capacity}</Row>}
      </dl>

      <ProductionSection object={object} type={type} isMine={isMine} />

      {isMine ? (
        <div className="flex gap-2 p-3.5">
          <button
            type="button"
            onClick={() => useGameStore.getState().startMoving(object.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/8 px-3 py-2 text-xs font-semibold text-slate-200 ring-1 ring-white/12 transition-colors hover:bg-white/14"
          >
            <Move className="size-3.5" />
            Taşı
          </button>
          <button
            type="button"
            onClick={() => useGameStore.getState().requestRemoval(object.id)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-500/12 px-3 py-2 text-xs font-semibold text-rose-300 ring-1 ring-rose-400/25 transition-colors hover:bg-rose-500/22"
          >
            <Trash2 className="size-3.5" />
            Kaldır
          </button>
        </div>
      ) : (
        <p className="flex items-center gap-2 px-3.5 py-3 text-[11px] text-slate-400">
          <User className="size-3.5" />
          Komşunun binası — düzenleyemezsin
        </p>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-slate-400">{label}</dt>
      <dd className="truncate text-right font-medium text-slate-100 tabular-nums">{children}</dd>
    </>
  );
}
