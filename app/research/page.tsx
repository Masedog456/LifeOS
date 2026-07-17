"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import type { ProjectAssembly } from "@/types/mvp";
import { createResearchProject, useStore } from "@/lib/mvpStore";

const STATUS_ORDER: Record<string, number> = { open: 0, investigating: 1, synthesizing: 2, concluded: 3, archived: 4, abandoned: 5 };

function snippet(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function ResearchWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const state = useStore();
  const [title, setTitle] = useState(params.get("title") ?? "");
  const [question, setQuestion] = useState(params.get("q") ?? "");
  const [purpose, setPurpose] = useState("");

  // Optional seed from an entry point.
  const seed = useMemo<{ assembly?: Partial<ProjectAssembly>; label?: string }>(() => {
    const belief = params.get("belief");
    if (belief) return { assembly: { beliefIds: [belief] }, label: `belief “${snippet(state.beliefs.find((b) => b.id === belief)?.text ?? "", 40)}”` };
    const thread = params.get("thread");
    if (thread) return { assembly: { threadIds: [thread] }, label: `thread “${snippet(state.megathreads.find((t) => t.id === thread)?.title ?? "", 40)}”` };
    const inquiry = params.get("inquiry");
    if (inquiry) return { label: `inquiry` };
    return {};
  }, [params, state]);

  function create() {
    if (!question.trim()) return;
    const id = createResearchProject({ title: title.trim() || question.trim().slice(0, 60), question, purpose, assembly: seed.assembly });
    router.push(`/research/${id}`);
  }

  const projects = [...state.researchProjects].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || (a.updatedAt < b.updatedAt ? 1 : -1),
  );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Research</h1>
        <p className="mt-1 text-sm text-zinc-500">
          A structured space to investigate a question before writing conclusions — questions, evidence,
          competing hypotheses, an argument map, and gap detection. Evidence-first and yours to direct; no
          autonomous research, no web browsing, no agents.
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-black/[.06] p-5 dark:border-white/[.08]">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">New investigation</h2>
        {seed.label && <p className="mt-1 text-xs text-zinc-400">Will attach your {seed.label} as starting evidence.</p>}
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} placeholder="The research question" className="mt-3 w-full resize-none rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]" />
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" className="mt-2 w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none dark:border-white/[.12]" />
        <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Purpose (optional)" className="mt-2 w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none dark:border-white/[.12]" />
        <button type="button" onClick={create} disabled={!question.trim()} className="mt-3 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900">Start investigation</button>
      </section>

      {projects.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Your investigations</h2>
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/research/${p.id}`} className="flex items-start gap-3 py-3">
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{p.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
                      <span>{p.status}</span>
                      <span>· {p.hypotheses.length} hypothesis{p.hypotheses.length === 1 ? "" : "es"}</span>
                      {p.seededProjectId && <span>· authored</span>}
                      <span>· {snippet(p.question, 50)}</span>
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

export default function ResearchPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12" />}>
      <ResearchWorkspace />
    </Suspense>
  );
}
