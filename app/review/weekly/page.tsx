"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AlignmentData, EvidenceItem, WeeklySynthesisData } from "@/types/mvp";
import {
  getStoreSnapshot,
  setReviewAlignment,
  setReviewSynthesis,
  startReview,
  useStore,
} from "@/lib/mvpStore";
import { buildWeeklyStats, estimateWeekly, runWeeklySynthesis, weeklyEvidence } from "@/lib/formation/weekly";
import { estimateAlignment, runAlignmentReflection, alignmentEvidence } from "@/lib/formation/alignment";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-black/[.06] px-3 py-2 dark:border-white/[.08]">
      <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{value}</div>
      <div className="text-[11px] text-zinc-400">{label}</div>
    </div>
  );
}

function Cited({ claims, evidence }: { claims: { statement: string; recordIds: string[] }[]; evidence: EvidenceItem[] }) {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  return (
    <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
      {claims.map((c, i) => (
        <li key={i} className="py-3">
          <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{c.statement}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {c.recordIds.map((id) => {
              const e = byId.get(id);
              return (
                <span key={id} className="rounded bg-black/[.05] px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-white/[.08]">
                  {e ? `${e.group}: ${e.text.slice(0, 40)}` : id}
                </span>
              );
            })}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function WeeklyReviewPage() {
  const state = useStore();
  const stats = useMemo(() => buildWeeklyStats(state), [state]);
  const weeklyEv = useMemo(() => weeklyEvidence(state), [state]);
  const alignEv = useMemo(() => alignmentEvidence(state), [state]);
  const weeklyEst = estimateWeekly(state);
  const alignEst = estimateAlignment(state);

  const [reviewId, setReviewId] = useState<string | null>(null);
  const [synthesis, setSynthesis] = useState<WeeklySynthesisData | null>(null);
  const [alignment, setAlignment] = useState<AlignmentData | null>(null);
  const [busy, setBusy] = useState<null | "weekly" | "alignment">(null);

  function ensureSession(): string {
    if (reviewId) return reviewId;
    const rid = startReview("weekly", []);
    setReviewId(rid);
    return rid;
  }

  async function genWeekly() {
    setBusy("weekly");
    try {
      const { synthesis: s, source } = await runWeeklySynthesis(getStoreSnapshot());
      setSynthesis(s);
      setReviewSynthesis(ensureSession(), s, source);
    } finally {
      setBusy(null);
    }
  }

  async function genAlignment() {
    setBusy("alignment");
    try {
      const { alignment: a, source } = await runAlignmentReflection(getStoreSnapshot());
      setAlignment(a);
      setReviewAlignment(ensureSession(), a, source);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link href="/review" className="text-sm text-zinc-500 underline-offset-4 hover:underline">← Today&apos;s review</Link>
      <header className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">This week</h1>
        <p className="mt-1 text-sm text-zinc-500">A factual roll-up of the last seven days. The narrative and alignment reflection are optional and only run when you ask.</p>
      </header>

      {/* Deterministic counts */}
      <section className="mb-8">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          <Stat label="beliefs affirmed" value={stats.beliefsAffirmed} />
          <Stat label="beliefs revised" value={stats.beliefsRevised} />
          <Stat label="beliefs questioned" value={stats.beliefsQuestioned} />
          <Stat label="new sources" value={stats.newSources} />
          <Stat label="comparisons" value={stats.comparisonsCompleted} />
          <Stat label="inquiries done" value={stats.inquiriesCompleted} />
          <Stat label="inquiries open" value={stats.inquiriesUnresolved} />
          <Stat label="threads changed" value={stats.threadsChanged} />
          <Stat label="reflections" value={stats.reflectionsWritten} />
          <Stat label="practices accepted" value={stats.practicesAccepted} />
        </div>
        {stats.recurringConcepts.length > 0 && (
          <p className="mt-3 text-sm text-zinc-500">Recurring concepts: {stats.recurringConcepts.join(", ")}</p>
        )}
        {stats.changesFromLastWeek.length > 0 && (
          <p className="mt-1 text-sm text-zinc-500">Vs last week: {stats.changesFromLastWeek.join(" · ")}</p>
        )}
        {stats.unresolvedTensions.length > 0 && (
          <div className="mt-2 text-sm text-zinc-500">
            Unresolved: <span className="text-zinc-600 dark:text-zinc-300">{stats.unresolvedTensions.slice(0, 4).join(" · ")}</span>
          </div>
        )}
      </section>

      {/* Optional narrative */}
      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Narrative summary</h2>
          <button type="button" onClick={genWeekly} disabled={busy !== null} className="rounded-full border border-black/[.12] px-3 py-1 text-xs hover:bg-black/[.04] disabled:opacity-40 dark:border-white/[.15] dark:hover:bg-white/[.06]">
            {busy === "weekly" ? "Generating…" : `Generate (~${weeklyEst.calls} AI call)`}
          </button>
        </div>
        {synthesis ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{synthesis.narrative}</p>
            {synthesis.highlights.length > 0 && <Cited claims={synthesis.highlights} evidence={weeklyEv} />}
            {synthesis.flagged && synthesis.flagged.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-amber-700 dark:text-amber-300">{synthesis.flagged.map((f, i) => <li key={i}>{f}</li>)}</ul>
            )}
            {synthesis.limitations.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-zinc-500">{synthesis.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">Optional. One AI call summarizes the week, citing your records. Nothing changes automatically.</p>
        )}
      </section>

      {/* Optional alignment reflection */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Alignment reflection</h2>
          <button type="button" onClick={genAlignment} disabled={busy !== null || alignEst.evidenceCount === 0} className="rounded-full border border-black/[.12] px-3 py-1 text-xs hover:bg-black/[.04] disabled:opacity-40 dark:border-white/[.15] dark:hover:bg-white/[.06]">
            {busy === "alignment" ? "Reflecting…" : `Reflect (~${alignEst.calls} AI call)`}
          </button>
        </div>
        <p className="mb-2 text-xs text-zinc-400">
          “What did I say I believe, and what did I report living?” Grounded only in your accepted beliefs, your reflections, and practices you accepted. It never accuses or assumes.
        </p>
        {alignment ? (
          <div className="flex flex-col gap-3">
            {alignment.observations.length > 0 ? (
              <Cited claims={alignment.observations} evidence={alignEv} />
            ) : (
              <p className="text-sm text-zinc-400">Nothing stood out as in tension — based only on what you recorded.</p>
            )}
            {alignment.questions.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-300">{alignment.questions.map((q, i) => <li key={i} className="mb-1">{q}</li>)}</ul>
            )}
            {alignment.limitations.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-zinc-500">{alignment.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">Optional and reflective — surfaces gentle questions, never conclusions.</p>
        )}
      </section>
    </main>
  );
}
