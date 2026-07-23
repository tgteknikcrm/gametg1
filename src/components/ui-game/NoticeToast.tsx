"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/useGameStore";

const VISIBLE_MS = 2200;

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

  return (
    <div
      key={notice.id}
      role="status"
      className={cn(
        "pointer-events-none absolute bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur",
        notice.tone === "error" ? "bg-rose-600/90" : "bg-emerald-600/90",
      )}
    >
      {notice.text}
    </div>
  );
}
