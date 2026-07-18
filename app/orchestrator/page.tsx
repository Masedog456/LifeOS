"use client";

import { useMemo, useState } from "react";
import type { OrchestratorSubsystem, Recommendation, RecommendationPriority } from "@/types/mvp";
import { refreshRecommendations, useStore } from "@/lib/mvpStore";
import { isActive } from "@/lib/orchestrator";
import RecommendationCard from "@/components/RecommendationCard";

const SUBSYSTEMS: OrchestratorSubsystem[] = ["belief", "research", "graph", "dialogue", "review", "formation", "decision", "world"];
const PRIORITIES: RecommendationPriority[] = ["high", "medium", "low"];
type StatusFilter = "active" | "snoozed" | "accepted" | "completed" | "dismissed" | "all";
const STATUS_FILTERS: StatusFilter[] = ["active", "snoozed", "accepted", "completed", "dismissed", "all"];

function matchesStatus(r: Recommendation, f: StatusFilter): boolean {
  const snoozed = Boolean(r.snoozedUntil && Date.parse(r.snoozedUntil) > Date.now());
  switch (f) {
    case "active": return isActive(r);
    case "snoozed": return snoozed && !r.dismissed && !r.completed;
    case "accepted": return r.accepted && !r.completed && !r.dismissed;
    case "completed": return r.completed;
    case "dismissed": return r.dismissed;
    case "all": return true;
  }
}

export default function OrchestratorPage() {
  const state = useStore();
  const [subsystem, setSubsystem] = useState<OrchestratorSubsystem | "all">("all");
  const [priority, setPriority] = useState<RecommendationPriority | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [scanNote, setScanNote] = useState<string | null>(null);

  const recs = state.recommendations;
  const activeCount = useMemo(() => recs.filter((r) => isActive(r)).length, [recs]);

  const filtered = useMemo(() => recs.filter((r) =>
    matchesStatus(r, status) &&
    (subsystem === "all" || r.subsystem === subsystem) &&
    (priority === "all" || r.priority === priority),
  ), [recs, status, subsystem, priority]);

  function scan() {
    refreshRecommendations();
    setScanNote("Scanned every subsystem.");
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">LifeOS Inbox</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your daily starting point. Every subsystem contributes deterministic recommendations — opportunities to act, never actions taken for you. {activeCount} active.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={scan} className="rounded-full border border-black/[.12] px-4 py-2 text-sm hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]">Scan now</button>
          {scanNote && <span className="text-xs text-zinc-500">{scanNote}</span>}
        </div>
      </header>

      <div className="mb-5 flex flex-col gap-2 text-xs">
        <FilterRow label="Status">
          {STATUS_FILTERS.map((s) => <Chip key={s} on={status === s} onClick={() => setStatus(s)}>{s}</Chip>)}
        </FilterRow>
        <FilterRow label="Priority">
          <Chip on={priority === "all"} onClick={() => setPriority("all")}>all</Chip>
          {PRIORITIES.map((p) => <Chip key={p} on={priority === p} onClick={() => setPriority(p)}>{p}</Chip>)}
        </FilterRow>
        <FilterRow label="Subsystem">
          <Chip on={subsystem === "all"} onClick={() => setSubsystem("all")}>all</Chip>
          {SUBSYSTEMS.map((s) => <Chip key={s} on={subsystem === s} onClick={() => setSubsystem(s)}>{s}</Chip>)}
        </FilterRow>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/[.10] p-6 text-sm text-zinc-500 dark:border-white/[.12]">
          {recs.length === 0
            ? "No recommendations yet. Click “Scan now” to let every subsystem surface opportunities from what you've captured, believed, researched, and discussed."
            : "Nothing matches these filters."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((r) => <RecommendationCard key={r.id} rec={r} />)}
        </div>
      )}
    </main>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-[68px] shrink-0 uppercase tracking-wide text-zinc-400">{label}</span>
      {children}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full px-2.5 py-1 transition-colors ${on ? "bg-black/[.06] font-medium dark:bg-white/[.10]" : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`}>
      {children}
    </button>
  );
}
