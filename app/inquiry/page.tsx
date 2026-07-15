"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import type { InquiryInputRef } from "@/types/mvp";
import { saveInquiry, useStore } from "@/lib/mvpStore";
import { estimateInquiry, runInquiryFlow, MAX_SOURCES } from "@/lib/dialectic/run";
import { SOURCE_TYPE_LABELS } from "@/lib/labels";

function snippet(s: string, n = 60): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function InquiryWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const state = useStore();

  // Seeds from entry-point links (URL only, stable at first render).
  const seedSources = useMemo(() => {
    const set = new Set<string>();
    const add = params.get("add");
    if (add) set.add(add);
    for (const s of (params.get("sources") ?? "").split(",").filter(Boolean)) set.add(s);
    return [...set].slice(0, MAX_SOURCES);
  }, [params]);
  const seedBelief = useMemo(() => params.get("belief") || null, [params]);
  const seedComparison = useMemo(() => params.get("comparison") || null, [params]);
  const seedQuestion = useMemo(() => params.get("q") || "", [params]);

  const [selected, setSelected] = useState<string[]>(seedSources);
  const [beliefId, setBeliefId] = useState<string | null>(seedBelief);
  const [comparisonId, setComparisonId] = useState<string | null>(seedComparison);
  const [question, setQuestion] = useState(seedQuestion);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmExpensive, setConfirmExpensive] = useState(false);

  const analyzable = state.sources.filter((s) => s.summary || s.keyConcepts.length || s.keyQuotes.length);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SOURCES) return prev;
      return [...prev, id];
    });
  }

  const inputs: InquiryInputRef[] = useMemo(() => {
    const list: InquiryInputRef[] = [];
    if (beliefId) {
      const b = state.beliefs.find((x) => x.id === beliefId);
      if (b) list.push({ kind: "belief", beliefId: b.id, label: `Belief: ${snippet(b.text, 40)}` });
    }
    if (comparisonId) {
      const c = state.comparisons.find((x) => x.id === comparisonId);
      if (c) list.push({ kind: "comparison", comparisonId: c.id, label: `Comparison: ${snippet(c.title, 40)}` });
    }
    for (const id of selected) {
      const s = state.sources.find((x) => x.id === id);
      if (s) list.push({ kind: "source", sourceId: s.id, label: s.title });
    }
    return list;
  }, [beliefId, comparisonId, selected, state.sources, state.beliefs, state.comparisons]);

  const est = useMemo(
    () => (selected.length >= 1 && question.trim() ? estimateInquiry(state, inputs, question) : null),
    [inputs, state, question, selected.length],
  );

  const canRun = selected.length >= 1 && question.trim().length > 0 && !running && (est ? !est.tooMany : true);
  const needsConfirm = !!est && est.calls >= 2 && !confirmExpensive;

  async function run() {
    if (!canRun) return;
    if (needsConfirm) {
      setConfirmExpensive(true);
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const inquiry = await runInquiryFlow(state, inputs, question);
      saveInquiry(inquiry);
      router.push(`/inquiry/${inquiry.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inquiry failed.");
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Inquiry</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Investigate a question through evidence, arguments, objections, and unresolved tensions —
          you decide what to believe.
        </p>
      </header>

      {/* Question */}
      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Central question</h2>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          placeholder="e.g. Does the Gospel of Thomas teach nonduality?"
          className="w-full resize-none rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]"
        />
      </section>

      {/* Optional belief */}
      {state.beliefs.filter((b) => b.status !== "rejected").length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Optional: a belief to challenge</h2>
          <select
            value={beliefId ?? ""}
            onChange={(e) => setBeliefId(e.target.value || null)}
            className="w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]"
          >
            <option value="">— none —</option>
            {state.beliefs.filter((b) => b.status !== "rejected").map((b) => (
              <option key={b.id} value={b.id}>{snippet(b.text, 70)}</option>
            ))}
          </select>
        </section>
      )}

      {/* Optional comparison */}
      {state.comparisons.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Optional: a saved comparison</h2>
          <select
            value={comparisonId ?? ""}
            onChange={(e) => setComparisonId(e.target.value || null)}
            className="w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]"
          >
            <option value="">— none —</option>
            {state.comparisons.map((c) => (
              <option key={c.id} value={c.id}>{snippet(c.title, 70)}</option>
            ))}
          </select>
        </section>
      )}

      {/* Sources */}
      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Sources ({selected.length}/{MAX_SOURCES})
        </h2>
        {analyzable.length === 0 ? (
          <p className="rounded-lg border border-dashed border-black/[.10] p-4 text-sm text-zinc-400 dark:border-white/[.12]">
            Add and analyze at least one source in your{" "}
            <Link href="/library" className="underline underline-offset-4">Library</Link> first.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {analyzable.map((s) => {
              const on = selected.includes(s.id);
              const disabled = !on && selected.length >= MAX_SOURCES;
              return (
                <li key={s.id}>
                  <label className={`flex cursor-pointer items-start gap-3 py-3 ${disabled ? "opacity-40" : ""}`}>
                    <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(s.id)} className="mt-1" />
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{s.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
                        <span>{SOURCE_TYPE_LABELS[s.type]}</span>
                        {s.author && <span>· {s.author}</span>}
                        {s.analysis?.coverage === "sampled" && <span>· partial coverage</span>}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Estimate + run */}
      {est && (
        <div className="mb-3 text-xs text-zinc-400">
          ~{est.calls} AI call{est.calls === 1 ? "" : "s"} · {est.evidence.length} evidence items
          {est.tooMany && <span className="ml-2 text-red-500">Too many sources (max {MAX_SOURCES}).</span>}
          {est.partial && <div className="mt-1 text-amber-600 dark:text-amber-400">⚠︎ {est.coverageNote}</div>}
        </div>
      )}
      {needsConfirm && (
        <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
          Larger inquiry ({est!.calls} AI calls, incl. a verification pass). Click again to confirm.
        </p>
      )}
      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <button
        type="button"
        onClick={run}
        disabled={!canRun}
        className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {running ? "Investigating…" : needsConfirm ? "Confirm & begin" : "Begin inquiry"}
      </button>

      {/* Saved inquiries */}
      {state.inquiries.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Saved inquiries</h2>
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {state.inquiries.map((i) => (
              <li key={i.id}>
                <Link href={`/inquiry/${i.id}`} className="flex items-start gap-3 py-3">
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{i.question}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
                      <span>{i.source === "ai" ? "AI" : "mock"}</span>
                      <span>· {i.status}</span>
                      {i.history.length > 0 && <span>· {i.history.length + 1} versions</span>}
                      {i.partial && <span>· partial</span>}
                      <span>· {new Date(i.createdAt).toLocaleDateString()}</span>
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

export default function InquiryPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12" />}>
      <InquiryWorkspace />
    </Suspense>
  );
}
