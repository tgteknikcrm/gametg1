"use client";

import dynamic from "next/dynamic";

import { BuildSidebar } from "@/components/ui-game/BuildSidebar";
import { ModeHint } from "@/components/ui-game/ModeHint";
import { NoticeToast } from "@/components/ui-game/NoticeToast";
import { SelectionPanel } from "@/components/ui-game/SelectionPanel";
import { TopBar } from "@/components/ui-game/TopBar";
import { useDevBridge } from "@/hooks/useDevBridge";
import { useKeyboardControls } from "@/hooks/useKeyboardControls";
import { useWorldMutations } from "@/hooks/useWorldMutations";
import { useWorldSync } from "@/hooks/useWorldSync";
import { toGameErrorMessage } from "@/lib/errors";
import { useWorldStore } from "@/store/useWorldStore";

/**
 * WebGL bağlamı sunucuda oluşturulamaz; Canvas'ı yalnızca istemcide yüklüyoruz.
 * HUD katmanları normal DOM olduğu için SSR'da render edilir.
 */
const GameCanvas = dynamic(() => import("@/components/game/GameCanvas"), {
  ssr: false,
  loading: () => <Overlay text="Sahne yükleniyor…" />,
});

export function GameShell() {
  const userId = useWorldStore((state) => state.userId);
  const { isReady, error } = useWorldSync(userId);
  const mutations = useWorldMutations();

  useKeyboardControls(mutations);
  useDevBridge(mutations);

  return (
    <main className="relative h-screen w-screen touch-none overflow-hidden bg-slate-900 select-none">
      <div className="absolute inset-0">
        <GameCanvas executor={mutations} />
      </div>

      <TopBar />
      <BuildSidebar />
      <SelectionPanel />
      <ModeHint />
      <NoticeToast />

      {error && <Overlay text={`Şehir yüklenemedi: ${toGameErrorMessage(error)}`} />}
      {!error && !isReady && <Overlay text="Şehir yükleniyor…" />}
    </main>
  );
}

function Overlay({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-slate-950/80 text-sm text-slate-300 backdrop-blur-sm">
      {text}
    </div>
  );
}
