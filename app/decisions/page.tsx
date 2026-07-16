"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { createDecision, useStore } from "@/lib/mvpStore";
import { decisionCaution } from "@/lib/decision/safety";

const STATUS_ORDER: Record<string, number> = { exploring: 0, narrowed: 1, decided: 2, deferred: 3, abandoned: 4 };

function snippet(s: string, n = 60): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function DecisionsWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const state = useStore();

  // Entry-point seeds: records force-included in the evidence packet.
  const seedRefs = useMemo(
    () => [params.get("belief"), params.get("thread"), params.get("reasoning"), params.get("reflection")].filter((x): x is string => Boolean(x)),
    [params],
  );
  const seedLabel = useMemo(() => {
    const b = params.get("belief");
    if (b) return `belief: “${snippet(state.beliefs.find((x) => x.id === b)?.text ?? "", 50)}”`;
    const t = params.get("thread");
    if (t) return `thread: “${snippet(state.megathreads.find((x) => x.id === t)?.title ?? "", 50)}”`;
    const q = params.get("reasoning");
    if (q) return `reasoning: “${snippet(state.reasonings.find((x) => x.id === q)?.question ?? "", 50)}”`;
    const r = params.get("reflection");
    if (r) return `reflection: “${snippet(state.reflections.find((x) => x.id === r)?.response ?? "", 50)}”`;
    return undefined;
  }, [params, state]);

  const [title, setTitle] = useState(params.get("title") ?? "");
  const [question, setQuestion] = useState(params.get("q") ?? "");
  const caution = decisionCaution(`${title} ${question}`);

  function create() {
    if (!question.trim()) return;
    const id = createDecision({
      title: title.trim() || question.trim().slice(0, 60),
      question,
      seedRefs,
      sensitive: caution,
    });
    router.push(`/decisions/${id}`);
  }

  const decisions = [...state.decisions].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || (a.updatedAt < b.updatedAt ? 1 : -1),
  );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Decisions</h1>
        <p className="mt-1 text-sm text-zinc-500">
          A structured space to see tradeoffs clearly, grounded in your own sources, beliefs, and
          reflections. LifeOS clarifies — you choose.
        </p>
      </header>

      {/* New decision */}
      <section className="mb-8 rounded-2xl border border-black/[.06] p-5 dark:border-white/[.08]">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">New decision</h2>
        {seedLabel && <p className="mt-1 text-xs text-zinc-400">Will include your {seedLabel} as evidence.</p>}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. The Denver job offer)"
          className="mt-3 w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]"
        />
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          placeholder="The decision question (e.g. Should I accept this job?)"
          className="mt-2 w-full resize-none rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]"
        />
        {caution && (
          <p className="mt-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {caution}
          </p>
        )}
        <button
          type="button"
          onClick={create}
          disabled={!question.trim()}
          className="mt-3 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Create decision
        </button>
      </section>

      {/* Saved decisions */}
      {decisions.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Your decisions</h2>
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {decisions.map((d) => (
              <li key={d.id}>
                <Link href={`/decisions/${d.id}`} className="flex items-start gap-3 py-3">
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{d.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
                      <span>{d.status}</span>
                      <span>· {d.options.length} option{d.options.length === 1 ? "" : "s"}</span>
                      {d.analysis && <span>· analyzed</span>}
                      {d.finalChoice && <span>· chosen: {snippet(d.options.find((o) => o.id === d.finalChoice)?.name ?? "", 24)}</span>}
                      <span>· updated {new Date(d.updatedAt).toLocaleDateString()}</span>
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

export default function DecisionsPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12" />}>
      <DecisionsWorkspace />
    </Suspense>
  );
}
