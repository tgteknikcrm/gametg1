"use client";

import { Coins, Trash2, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { IsoBlock } from "@/components/ui-game/IsoBlock";
import { useWorldMutations } from "@/hooks/useWorldMutations";
import { useGameStore } from "@/store/useGameStore";
import { getObjectType, useWorldStore } from "@/store/useWorldStore";

/**
 * Yıkım onayı.
 *
 * Silme geri alınamaz ve maliyetin yalnızca bir kısmı iade edilir, bu yüzden
 * hem panel düğmesi hem de Delete tuşu doğrudan silmez — ikisi de buraya uğrar.
 */
export function ConfirmRemoval() {
  const objectId = useGameStore((state) => state.pendingRemovalId);
  const cancelRemoval = useGameStore((state) => state.cancelRemoval);
  const object = useWorldStore((state) =>
    state.objects.find((candidate) => candidate.id === objectId),
  );
  const mutations = useWorldMutations();
  const type = getObjectType(object?.type_id ?? null);

  // Escape ile kapat. Kayıt, panel açıkken diğer kısayolların önüne geçer.
  useEffect(() => {
    if (!objectId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        cancelRemoval();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [objectId, cancelRemoval]);

  if (!objectId || !object || !type) return null;

  const refund = Math.floor(type.cost * type.refund_rate);
  const loss = type.cost - refund;

  const confirm = () => {
    mutations.remove(object.id);
    useGameStore.getState().selectObject(null);
    cancelRemoval();
  };

  return (
    <div
      className="absolute inset-0 z-50 grid place-items-center bg-slate-950/60 backdrop-blur-sm"
      onClick={cancelRemoval}
    >
      <div
        className="hud-card w-full max-w-[340px] p-5"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/25">
            <TriangleAlert className="size-4.5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm leading-tight font-semibold text-slate-50">
              Bu yapıyı kaldırmak istediğine emin misin?
            </h2>
            <p className="mt-1 text-[12px] text-slate-400">Bu işlem geri alınamaz.</p>
          </div>
        </div>

        <div className="hud-inset mt-4 flex items-center gap-3 px-3 py-2.5">
          <IsoBlock color={type.color} size={34} tall={type.block_height > 1.6} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-slate-100">{type.name}</p>
            <p className="text-[11px] text-slate-400 tabular-nums">
              Konum {object.local_x}, {object.local_y}
            </p>
          </div>
        </div>

        <dl className="mt-3 space-y-1 text-[11px]">
          <div className="flex justify-between">
            <dt className="text-slate-400">İade edilecek</dt>
            <dd className="flex items-center gap-1 font-semibold text-emerald-300 tabular-nums">
              <Coins className="size-3" />
              {refund.toLocaleString("tr-TR")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Kaybedilecek</dt>
            <dd className="flex items-center gap-1 font-semibold text-rose-300 tabular-nums">
              <Coins className="size-3" />
              {loss.toLocaleString("tr-TR")}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={cancelRemoval}
            autoFocus
            className="flex-1 rounded-xl bg-white/8 px-3 py-2.5 text-xs font-semibold text-slate-200 ring-1 ring-white/12 transition-colors hover:bg-white/14"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={confirm}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-500 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-rose-400"
          >
            <Trash2 className="size-3.5" />
            Kaldır
          </button>
        </div>
      </div>
    </div>
  );
}
