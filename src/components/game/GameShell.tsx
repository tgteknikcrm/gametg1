"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

import { LoadFailure } from "@/components/game/LoadFailure";
import { BuildSidebar } from "@/components/ui-game/BuildSidebar";
import { ConfirmRemoval } from "@/components/ui-game/ConfirmRemoval";
import { HarvestAllButton } from "@/components/ui-game/HarvestAllButton";
import { InventoryPanel } from "@/components/ui-game/InventoryPanel";
import { ModeHint } from "@/components/ui-game/ModeHint";
import { NoticeToast } from "@/components/ui-game/NoticeToast";
import { ResourceBar } from "@/components/ui-game/ResourceBar";
import { SelectionPanel } from "@/components/ui-game/SelectionPanel";
import { TopBar } from "@/components/ui-game/TopBar";
import { useDevBridge } from "@/hooks/useDevBridge";
import { useKeyboardControls } from "@/hooks/useKeyboardControls";
import { useProductionClock } from "@/hooks/useProductionClock";
import { useProductionMutations } from "@/hooks/useProductionMutations";
import { useWorldMutations } from "@/hooks/useWorldMutations";
import { useWorldSync } from "@/hooks/useWorldSync";
import { useWorldStore } from "@/store/useWorldStore";

/**
 * WebGL bağlamı sunucuda oluşturulamaz; Canvas'ı yalnızca istemcide yüklüyoruz.
 * HUD katmanları normal DOM olduğu için SSR'da render edilir.
 */
const GameCanvas = dynamic(() => import("@/components/game/GameCanvas"), { ssr: false });

export function GameShell() {
  const userId = useWorldStore((state) => state.userId);
  const { isReady, error } = useWorldSync(userId);
  const mutations = useWorldMutations();
  const production = useProductionMutations();

  useKeyboardControls(mutations);
  useProductionClock(production);
  useDevBridge(mutations, production);

  return (
    <main
      className="relative h-screen w-screen touch-none overflow-hidden select-none"
      // Gökyüzü CSS degradesi: tuval şeffaf, GPU'ya hiçbir maliyeti yok.
      style={{ background: "linear-gradient(180deg, var(--sky-top), var(--sky-bottom))" }}
    >
      <div className="absolute inset-0">
        <GameCanvas executor={mutations} />
      </div>

      {/* Kenarlarda hafif koyulaşma — panelleri sahneden ayırır. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(15,26,46,0.28) 100%)" }}
      />

      <ResourceBar />
      <TopBar />
      <HarvestAllButton />
      <BuildSidebar />
      <InventoryPanel />
      <SelectionPanel />
      <ModeHint />
      <NoticeToast />
      <ConfirmRemoval />

      {error && <LoadFailure error={error} />}
      {!error && !isReady && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-slate-950/70 backdrop-blur-sm">
          <div className="hud-card flex items-center gap-2.5 px-4 py-3 text-[13px] text-slate-200">
            <Loader2 className="size-4 animate-spin text-emerald-300" />
            Şehir yükleniyor…
          </div>
        </div>
      )}
    </main>
  );
}
