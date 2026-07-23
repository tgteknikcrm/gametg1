"use client";

import dynamic from "next/dynamic";

import { BuildSidebar } from "@/components/ui-game/BuildSidebar";
import { ModeHint } from "@/components/ui-game/ModeHint";
import { NoticeToast } from "@/components/ui-game/NoticeToast";
import { SelectionPanel } from "@/components/ui-game/SelectionPanel";
import { TopBar } from "@/components/ui-game/TopBar";
import { useDevBridge } from "@/hooks/useDevBridge";
import { useKeyboardControls } from "@/hooks/useKeyboardControls";

/**
 * WebGL bağlamı sunucuda oluşturulamaz; Canvas'ı yalnızca istemcide yüklüyoruz.
 * HUD katmanları normal DOM olduğu için SSR'da render edilir.
 */
const GameCanvas = dynamic(() => import("@/components/game/GameCanvas"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-slate-900 text-sm text-slate-400">
      Sahne yükleniyor…
    </div>
  ),
});

export function GameShell() {
  useKeyboardControls();
  useDevBridge();

  return (
    <main className="relative h-screen w-screen touch-none overflow-hidden bg-slate-900 select-none">
      <div className="absolute inset-0">
        <GameCanvas />
      </div>

      <TopBar />
      <BuildSidebar />
      <SelectionPanel />
      <ModeHint />
      <NoticeToast />
    </main>
  );
}
