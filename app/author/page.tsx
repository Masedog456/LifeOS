"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import type { ProjectAssembly, ProjectKind } from "@/types/mvp";
import { createKnowledgeProject, useStore } from "@/lib/mvpStore";
import { projectKindLabel } from "@/lib/authoring/outline";

const KINDS: ProjectKind[] = ["book", "essay", "lecture", "course", "research_paper", "blog_series", "guide", "philosophy"];
const STATUS_ORDER: Record<string, number> = { planning: 0, outlining: 1, drafting: 2, revising: 3, complete: 4, archived: 5 };

function snippet(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function AuthorWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const state = useStore();
  const [title, setTitle] = useState(params.get("title") ?? "");
  const [kind, setKind] = useState<ProjectKind>("essay");
  const [purpose, setPurpose] = useState("");
  const [audience, setAudience] = useState("");

  // Pre-seed the assembly from an entry point (?thread / ?concept / ?framework).
  const seed = useMemo<{ assembly?: Partial<ProjectAssembly>; label?: string }>(() => {
    const thread = params.get("thread");
    if (thread) return { assembly: { threadIds: [thread] }, label: `thread “${snippet(state.megathreads.find((t) => t.id === thread)?.title ?? "", 40)}”` };
    const concept = params.get("concept");
    if (concept) return { assembly: { conceptIds: [concept] }, label: `concept “${snippet(state.concepts.find((c) => c.id === concept)?.name ?? "", 40)}”` };
    const framework = params.get("framework");
    if (framework) return { assembly: { frameworkIds: [framework] }, label: `framework “${snippet(state.frameworks.find((f) => f.id === framework)?.name ?? "", 40)}”` };
    return {};
  }, [params, state]);

  function create() {
    if (!title.trim()) return;
    const id = createKnowledgeProject({ title, kind, purpose, audience, assembly: seed.assembly });
    router.push(`/author/${id}`);
  }

  const projects = [...state.knowledgeProjects].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || (a.updatedAt < b.updatedAt ? 1 : -1),
  );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Author</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Turn what you have learned into a book, essay, lecture, course, paper, guide, or a statement of
          your own philosophy. Evidence-first and yours to direct — LifeOS assembles, outlines, and drafts
          one section at a time; it never writes on its own and never invents a citation.
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-black/[.06] p-5 dark:border-white/[.08]">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">New project</h2>
        {seed.label && <p className="mt-1 text-xs text-zinc-400">Will assemble your {seed.label} as starting evidence.</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                kind === k ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-black/[.12] text-zinc-500 hover:text-zinc-900 dark:border-white/[.15] dark:hover:text-zinc-100"
              }`}
            >
              {projectKindLabel(k)}
            </button>
          ))}
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="mt-3 w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]" />
        <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Purpose (what is this for?)" className="mt-2 w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none dark:border-white/[.12]" />
        <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Audience (who is it for?)" className="mt-2 w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none dark:border-white/[.12]" />
        <button type="button" onClick={create} disabled={!title.trim()} className="mt-3 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900">
          Create project
        </button>
      </section>

      {projects.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Your projects</h2>
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/author/${p.id}`} className="flex items-start gap-3 py-3">
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{p.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
                      <span>{projectKindLabel(p.kind)}</span>
                      <span>· {p.status}</span>
                      <span>· {p.sections.length} section{p.sections.length === 1 ? "" : "s"}</span>
                      {p.purpose && <span>· {snippet(p.purpose, 40)}</span>}
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

export default function AuthorPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12" />}>
      <AuthorWorkspace />
    </Suspense>
  );
}
