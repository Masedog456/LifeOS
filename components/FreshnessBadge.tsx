"use client";

import { useState } from "react";
import type { SavedFingerprint, StoreState } from "@/types/mvp";
import { FRESHNESS_LABEL, freshnessStatus } from "@/lib/freshness/fingerprint";

const STATUS_STYLE: Record<string, string> = {
  current: "border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  potentially_stale: "border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  stale: "border-amber-400/70 bg-amber-100 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100",
  unknown: "border-black/[.12] bg-black/[.03] text-zinc-500 dark:border-white/[.15] dark:bg-white/[.05] dark:text-zinc-400",
};

/**
 * Shows whether a saved result is still current with its evidence, and offers
 * an explicit re-run. Re-running preserves prior history and never overwrites
 * user conclusions (the caller's handler owns that). No background reruns.
 */
export default function FreshnessBadge({
  state, fingerprint, currentIds, onRerun, approxAiCalls, approxEmbedCalls,
}: {
  state: StoreState;
  fingerprint?: SavedFingerprint;
  currentIds?: string[];
  onRerun?: () => Promise<void> | void;
  approxAiCalls?: number;
  approxEmbedCalls?: number;
}) {
  const [running, setRunning] = useState(false);
  const { status, reasons } = freshnessStatus(state, fingerprint, currentIds);

  async function rerun() {
    if (!onRerun || running) return;
    setRunning(true);
    try {
      await onRerun();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${STATUS_STYLE[status]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">Evidence: {FRESHNESS_LABEL[status]}</span>
        {onRerun && (status === "stale" || status === "potentially_stale") && (
          <button
            type="button"
            onClick={rerun}
            disabled={running}
            className="rounded-full border border-black/[.15] bg-white/60 px-3 py-1 text-xs font-medium hover:bg-white disabled:opacity-40 dark:border-white/[.2] dark:bg-black/20 dark:hover:bg-black/40"
          >
            {running
              ? "Re-running…"
              : `Re-run (~${approxAiCalls ?? 1} AI${approxEmbedCalls ? ` · ~${approxEmbedCalls} embed` : ""})`}
          </button>
        )}
      </div>
      {reasons.length > 0 && (
        <p className="mt-1 text-xs opacity-90">{reasons.join(" · ")}</p>
      )}
    </div>
  );
}
