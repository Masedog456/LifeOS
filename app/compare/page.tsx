"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import type { ComparisonInputRef } from "@/types/mvp";
import { saveComparison, useStore } from "@/lib/mvpStore";
import { estimateComparison, runComparisonFlow, MAX_SOURCES } from "@/lib/comparison/run";
import { SOURCE_TYPE_LABELS } from "@/lib/labels";

function snippet(s: string, n = 60): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function CompareWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const state = useStore();

  // Pre-seed selection from entry-point links. Computed from the URL only
  // (not from the not-yet-hydrated store), so it's stable at first render and
  // usable as initial state. Invalid ids are harmless — the render below only
  // ever shows/uses ids that match a real source/belief.
  const seedSources = useMemo(() => {
    const set = new Set<string>();
    const add = params.get("add");
    if (add) set.add(add);
    for (const s of (params.get("sources") ?? "").split(",").filter(Boolean)) set.add(s);
    return [...set].slice(0, MAX_SOURCES);
  }, [params]);
  const seedBelief = useMemo(() => params.get("belief") || null, [params]);

  const [selected, setSelected] = useState<string[]>(seedSources);
  const [beliefId, setBeliefId] = useState<string | null>(seedBelief);
  const [question, setQuestion] = useState("");

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

  const inputs: ComparisonInputRef[] = useMemo(() => {
    const list: ComparisonInputRef[] = [];
    if (beliefId) {
      const b = state.beliefs.find((x) => x.id === beliefId);
      if (b) list.push({ kind: "belief", beliefId: b.id, label: `Belief: ${snippet(b.text, 40)}` });
    }
    for (const id of selected) {
      const s = state.sources.find((x) => x.id === id);
      if (s) list.push({ kind: "source", sourceId: s.id, label: s.title });
    }
    return list;
  }, [beliefId, selected, state.sources, state.beliefs]);

  const est = useMemo(
    () => (inputs.length >= 2 ? estimateComparison(state, inputs, question) : null),
    [inputs, state, question],
  );

  const enoughMaterials =
    inputs.length >= 2 && (beliefId ? selected.length >= 1 : selected.length >= 2);
  const canRun = enoughMaterials && !running && (est ? !est.tooMany : true);
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
      const comparison = await runComparisonFlow(state, inputs, question);
      saveComparison(comparison);
      router.push(`/compare/${comparison.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed.");
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Compare</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Select 2–{MAX_SOURCES} sources (or a belief plus sources) to compare — preserving genuine
          differences and exact provenance.
        </p>
      </header>

      {/* Belief (optional) */}
      {state.beliefs.filter((b) => b.status !== "rejected").length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Optional: compare a belief
          </h2>
          <select
            value={beliefId ?? ""}
            onChange={(e) => setBeliefId(e.target.value || null)}
            className="w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]"
          >
            <option value="">— none —</option>
            {state.beliefs
              .filter((b) => b.status !== "rejected")
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {snippet(b.text, 70)}
                </option>
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
            Add and analyze at least two sources in your{" "}
            <Link href="/library" className="underline underline-offset-4">Library</Link> first.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {analyzable.map((s) => {
              const on = selected.includes(s.id);
              const disabled = !on && selected.length >= MAX_SOURCES;
              return (
                <li key={s.id}>
                  <label
                    className={`flex cursor-pointer items-start gap-3 py-3 ${disabled ? "opacity-40" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={disabled}
                      onChange={() => toggle(s.id)}
                      className="mt-1"
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {s.title}
                      </span>
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

      {/* Question */}
      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Comparison question (optional)
        </h2>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. How do these treat the self?"
          className="w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]"
        />
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
          This is a larger comparison ({est!.calls} AI calls, incl. a verification pass). Click again to confirm.
        </p>
      )}
      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <button
        type="button"
        onClick={run}
        disabled={!canRun}
        className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {running ? "Comparing…" : needsConfirm ? "Confirm & run" : "Run comparison"}
      </button>

      {/* Saved comparisons */}
      {state.comparisons.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Saved comparisons
          </h2>
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {state.comparisons.map((c) => (
              <li key={c.id}>
                <Link href={`/compare/${c.id}`} className="flex items-start gap-3 py-3">
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {c.title}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
                      <span>{c.source === "ai" ? "AI" : "mock"}</span>
                      {c.partial && <span>· partial</span>}
                      <span>· {new Date(c.createdAt).toLocaleDateString()}</span>
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

export default function ComparePage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12" />}>
      <CompareWorkspace />
    </Suspense>
  );
}
