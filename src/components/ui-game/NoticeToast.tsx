"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/useGameStore";

const VISIBLE_MS = 2400;

/** Kısa bildirim. Her `notice.id` için bir kez zamanlayıcı kurar. */
export function NoticeToast() {
  const notice = useGameStore((state) => state.notice);
  const dismissNotice = useGameStore((state) => state.dismissNotice);
  const noticeId = notice?.id;

  useEffect(() => {
    if (noticeId === undefined) return;
    const timer = window.setTimeout(() => dismissNotice(noticeId), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [noticeId, dismissNotice]);

  if (!notice) return null;
  const isError = notice.tone === "error";

  return (
    <div
      key={notice.id}
      role="status"
      className={cn(
        "hud-card pointer-events-none absolute bottom-20 left-1/2 z-30 flex -translate-x-1/2",
        "animate-in fade-in slide-in-from-bottom-2 items-center gap-2 py-2 pr-4 pl-3 duration-200",
      )}
    >
      <span
        className={cn(
          "grid size-6 place-items-center rounded-lg ring-1",
          isError
            ? "bg-rose-500/20 text-rose-300 ring-rose-400/30"
            : "bg-emerald-500/20 text-emerald-300 ring-emerald-400/30",
        )}
      >
        {isError ? <TriangleAlert className="size-3.5" /> : <CircleCheck className="size-3.5" />}
      </span>
      <span className="text-[13px] font-medium text-slate-100">{notice.text}</span>
    </div>
  );
}
