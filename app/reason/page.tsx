"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import type { ReasoningMode, ReasoningScope, ReasoningScopeKind } from "@/types/mvp";
import { saveReasoning, useStore } from "@/lib/mvpStore";
import { estimateReasoning, MODE_LABEL, runReasoning } from "@/lib/reasoning/run";
import { MAX_SCOPE_SOURCES } from "@/lib/reasoning/graph";

const MODES: ReasoningMode[] = [
  "support_audit", "contradiction_audit", "influence_trace", "assumption_audit",
  "belief_impact", "unresolved_synthesis", "change_over_time", "open_inquiry",
];
const MODE_DEFAULT_Q: Record<ReasoningMode, string> = {
  support_audit: "Which of my beliefs are weakly supported?",
  contradiction_audit: "What tensions exist among my beliefs?",
  influence_trace: "What shaped this view?",
  assumption_audit: "What assumptions recur across my inquiries?",
  belief_impact: "If I accepted this, what would it affect?",
  unresolved_synthesis: "Which questions remain open across the system?",
  change_over_time: "Where have I changed my mind most?",
  open_inquiry: "",
};
const SCOPE_KINDS: ReasoningScopeKind[] = ["all", "beliefs", "sources", "threads"];

function snippet(s: string, n = 60): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function ReasonWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const state = useStore();

  const seedMode = (params.get("mode") as ReasoningMode | null) ?? "support_audit";
  const [mode, setMode] = useState<ReasoningMode>(MODES.includes(seedMode) ? seedMode : "support_audit");
  const [question, setQuestion] = useState(params.get("q") || MODE_DEFAULT_Q[MODES.includes(seedMode) ? seedMode : "support_audit"]);
  const [proposed, setProposed] = useState(params.get("proposed") || "");

  const seedScopeKind: ReasoningScopeKind = params.get("belief")
    ? "beliefs" : params.get("source") ? "sources" : params.get("thread") ? "threads" : "all";
  const [scopeKind, setScopeKind] = useState<ReasoningScopeKind>(seedScopeKind);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const one = params.get("belief") || params.get("source") || params.get("thread");
    return one ? [one] : [];
  });

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmExpensive, setConfirmExpensive] = useState(false);

  const scopeOptions = useMemo(() => {
    if (scopeKind === "beliefs") return state.beliefs.filter((b) => b.status !== "rejected").map((b) => ({ id: b.id, label: snippet(b.text) }));
    if (scopeKind === "sources") return state.sources.map((s) => ({ id: s.id, label: s.title }));
    if (scopeKind === "threads") return state.megathreads.map((t) => ({ id: t.id, label: t.title }));
    return [];
  }, [scopeKind, state]);

  const scope: ReasoningScope = useMemo(() => {
    if (scopeKind === "all") return { kind: "all", ...(mode === "belief_impact" ? { proposedBelief: proposed } : {}) };
    const key = scopeKind === "beliefs" ? "beliefIds" : scopeKind === "sources" ? "sourceIds" : "threadIds";
    return { kind: scopeKind, [key]: selectedIds, ...(mode === "belief_impact" ? { proposedBelief: proposed } : {}) };
  }, [scopeKind, selectedIds, mode, proposed]);

  const est = useMemo(() => estimateReasoning(state, mode, scope), [state, mode, scope]);
  const needsConfirm = est.calls >= 2 && !confirmExpensive;
  const canRun = !running && !est.tooMany && (mode === "belief_impact" ? (proposed.trim() || question.trim()) : question.trim());

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function run() {
    if (!canRun) return;
    if (needsConfirm) { setConfirmExpensive(true); return; }
    setRunning(true);
    setError(null);
    try {
      const q = await runReasoning(state, question, mode, scope);
      saveReasoning(q);
      router.push(`/reason/${q.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reasoning failed.");
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reason</h1>
        <p className="mt-1 text-sm text-zinc-500">Ask a higher-order question across your knowledge — grounded in evidence, decided by you.</p>
      </header>

      {/* Mode */}
      <section className="mb-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Reasoning mode</h2>
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); if (!question.trim() || MODES.some((x) => MODE_DEFAULT_Q[x] === question)) setQuestion(MODE_DEFAULT_Q[m]); }}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${mode === m ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-black/[.10] text-zinc-500 hover:text-zinc-900 dark:border-white/[.12] dark:hover:text-zinc-100"}`}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </section>

      {/* Question */}
      <section className="mb-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Question</h2>
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2}
          className="w-full resize-none rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]" />
        {mode === "belief_impact" && (
          <input value={proposed} onChange={(e) => setProposed(e.target.value)} placeholder="Proposed belief to analyze…"
            className="mt-2 w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]" />
        )}
      </section>

      {/* Scope */}
      <section className="mb-5">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Scope</h2>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SCOPE_KINDS.map((k) => (
            <button key={k} type="button" onClick={() => { setScopeKind(k); setSelectedIds([]); }}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${scopeKind === k ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-black/[.10] text-zinc-500 hover:text-zinc-900 dark:border-white/[.12] dark:hover:text-zinc-100"}`}>
              {k === "all" ? "Entire library" : k}
            </button>
          ))}
        </div>
        {scopeKind !== "all" && (
          <ul className="max-h-48 overflow-y-auto rounded-lg border border-black/[.08] p-2 dark:border-white/[.10]">
            {scopeOptions.length === 0 ? (
              <li className="p-1 text-sm text-zinc-400">Nothing to select.</li>
            ) : scopeOptions.map((o) => (
              <li key={o.id}>
                <label className="flex cursor-pointer items-center gap-2 p-1 text-sm">
                  <input type="checkbox" checked={selectedIds.includes(o.id)} onChange={() => toggle(o.id)} />
                  <span className="text-zinc-800 dark:text-zinc-200">{o.label}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Estimate + run */}
      <div className="mb-3 text-xs text-zinc-400">
        ~{est.calls} AI call{est.calls === 1 ? "" : "s"} · {est.evidenceCount} evidence items · {est.nodeCount} records
        {est.tooMany && <span className="ml-2 text-red-500">Scope too large (max {MAX_SCOPE_SOURCES} sources).</span>}
        {est.partial && <div className="mt-1 text-amber-600 dark:text-amber-400">⚠︎ {est.coverageNote}</div>}
      </div>
      {needsConfirm && <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">Larger scope ({est.calls} AI calls, incl. a verification pass). Click again to confirm.</p>}
      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <button type="button" onClick={run} disabled={!canRun}
        className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900">
        {running ? "Reasoning…" : needsConfirm ? "Confirm & run" : "Run reasoning"}
      </button>

      {/* Saved sessions */}
      {state.reasonings.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Saved reasoning</h2>
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {state.reasonings.map((q) => (
              <li key={q.id}>
                <Link href={`/reason/${q.id}`} className="flex items-start gap-3 py-3">
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{q.question || MODE_LABEL[q.mode]}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
                      <span>{MODE_LABEL[q.mode]}</span>
                      <span>· {q.source === "ai" ? "AI" : "mock"}</span>
                      <span>· {q.status}</span>
                      {q.history.length > 0 && <span>· {q.history.length + 1} runs</span>}
                      <span>· {new Date(q.createdAt).toLocaleDateString()}</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

export default function ReasonPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12" />}>
      <ReasonWorkspace />
    </Suspense>
  );
}
