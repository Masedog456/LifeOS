"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { KnowledgeProject, ProjectAssembly, ProjectStatus, StoreState } from "@/types/mvp";
import {
  addProjectSection,
  chooseProjectOutline,
  getStoreSnapshot,
  knowledgeProjectById,
  markProjectReviewed,
  setProjectFields,
  setProjectOutlines,
  toggleProjectEvidence,
  useStore,
} from "@/lib/mvpStore";
import { runOutlineGeneration, projectKindLabel } from "@/lib/authoring/outline";
import { assemblyCount } from "@/lib/authoring/assembly";
import { citationCoverage, unsupportedAcrossProject } from "@/lib/authoring/citations";
import { projectDeps } from "@/lib/freshness/fingerprint";
import AuthoringSection from "@/components/AuthoringSection";
import ExportBar from "@/components/ExportBar";
import FreshnessBadge from "@/components/FreshnessBadge";

const STATUSES: ProjectStatus[] = ["planning", "outlining", "drafting", "revising", "complete", "archived"];

function snippet(s: string, n = 44): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

/** A toggle list for one evidence type in the assembly. */
function EvidencePicker({
  projectId, field, selected, items, label,
}: {
  projectId: string;
  field: keyof ProjectAssembly;
  selected: string[];
  items: { id: string; label: string }[];
  label: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{label} ({selected.length}/{items.length})</h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <button key={it.id} type="button" onClick={() => toggleProjectEvidence(projectId, field, it.id)} className={`rounded-full px-2.5 py-1 text-[11px] ${selected.includes(it.id) ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-black/[.12] text-zinc-500 dark:border-white/[.15]"}`}>
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function pickItems(state: StoreState) {
  return {
    sources: state.sources.map((s) => ({ id: s.id, label: snippet(s.title, 30) })),
    beliefs: state.beliefs.filter((b) => b.status !== "rejected").map((b) => ({ id: b.id, label: snippet(b.text, 30) })),
    concepts: state.concepts.map((c) => ({ id: c.id, label: snippet(c.name, 30) })),
    threads: state.megathreads.map((t) => ({ id: t.id, label: snippet(t.title, 30) })),
    reasonings: state.reasonings.map((q) => ({ id: q.id, label: snippet(q.question, 30) })),
    frameworks: state.frameworks.map((f) => ({ id: f.id, label: snippet(f.name, 30) })),
    principles: state.principles.map((p) => ({ id: p.id, label: snippet(p.statement, 30) })),
    formation: state.formationSessions.map((f) => ({ id: f.id, label: snippet(f.title, 30) })),
    decisions: state.decisions.map((d) => ({ id: d.id, label: snippet(d.title, 30) })),
  };
}

export default function AuthorProjectPage() {
  const { id } = useParams<{ id: string }>();
  const state = useStore();
  const project = useMemo(() => knowledgeProjectById(state, id), [state, id]);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSection, setNewSection] = useState("");

  const items = useMemo(() => pickItems(state), [state]);
  const coverage = useMemo(() => (project ? citationCoverage(state, project) : null), [state, project]);
  const unsupported = useMemo(() => (project ? unsupportedAcrossProject(project) : []), [project]);

  if (!project) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-zinc-600 dark:text-zinc-300">Project not found.</p>
        <Link href="/author" className="text-sm text-zinc-500 underline-offset-4 hover:underline">← Back to Author</Link>
      </main>
    );
  }
  const p: KnowledgeProject = project;

  async function generate() {
    if (running) return;
    setRunning(true);
    setError(null);
    try {
      const r = await runOutlineGeneration(getStoreSnapshot(), p);
      setProjectOutlines(p.id, r.options, r.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Outline generation failed.");
    } finally {
      setRunning(false);
    }
  }

  const sortedSections = [...p.sections].sort((a, b) => a.order - b.order);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link href="/author" className="text-sm text-zinc-400 underline-offset-4 hover:underline">← Author</Link>

      <header className="mb-6 mt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{projectKindLabel(p.kind)}</p>
        <input defaultValue={p.title} onBlur={(e) => e.target.value.trim() && e.target.value !== p.title && setProjectFields(p.id, { title: e.target.value.trim() })} className="mt-1 w-full bg-transparent text-2xl font-semibold tracking-tight outline-none" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STATUSES.map((st) => (
            <button key={st} type="button" onClick={() => setProjectFields(p.id, { status: st })} className={`rounded-full px-2.5 py-1 text-[11px] ${p.status === st ? "bg-black/[.06] font-medium dark:bg-white/[.10]" : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`}>{st}</button>
          ))}
        </div>
      </header>

      {/* Assembly */}
      <section className="mb-8">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">1 · Assemble evidence</h2>
        <p className="mb-3 text-xs text-zinc-400">Choose what this work draws on. Everything keeps provenance; {assemblyCount(p.assembly)} record{assemblyCount(p.assembly) === 1 ? "" : "s"} assembled.</p>
        <div className="flex flex-col gap-4 rounded-2xl border border-black/[.06] p-5 dark:border-white/[.08]">
          <EvidencePicker projectId={p.id} field="sourceIds" selected={p.assembly.sourceIds} items={items.sources} label="Sources" />
          <EvidencePicker projectId={p.id} field="beliefIds" selected={p.assembly.beliefIds} items={items.beliefs} label="Beliefs" />
          <EvidencePicker projectId={p.id} field="conceptIds" selected={p.assembly.conceptIds} items={items.concepts} label="Concepts" />
          <EvidencePicker projectId={p.id} field="threadIds" selected={p.assembly.threadIds} items={items.threads} label="Threads" />
          <EvidencePicker projectId={p.id} field="reasoningIds" selected={p.assembly.reasoningIds} items={items.reasonings} label="Reasonings" />
          <EvidencePicker projectId={p.id} field="frameworkIds" selected={p.assembly.frameworkIds} items={items.frameworks} label="Frameworks" />
          <EvidencePicker projectId={p.id} field="principleIds" selected={p.assembly.principleIds} items={items.principles} label="Principles" />
          <EvidencePicker projectId={p.id} field="formationIds" selected={p.assembly.formationIds} items={items.formation} label="Reflections" />
          <EvidencePicker projectId={p.id} field="decisionIds" selected={p.assembly.decisionIds} items={items.decisions} label="Decisions" />
          {assemblyCount(p.assembly) === 0 && <p className="text-xs text-zinc-400">Nothing assembled yet — select records above (or add some elsewhere in LifeOS first).</p>}
        </div>
      </section>

      {/* Outlines */}
      <section className="mb-8">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">2 · Choose an outline</h2>
        <p className="mb-3 text-xs text-zinc-400">Several structures are proposed from your evidence. Compare and pick one — nothing is chosen for you.</p>
        <button type="button" onClick={generate} disabled={running} className="mb-3 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900">
          {running ? "Generating…" : p.outlineOptions.length ? "Regenerate outlines" : "Generate outlines"}
        </button>
        {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {p.outlineOptions.length > 0 && (
          <div className="flex flex-col gap-3">
            {p.outlineOptions.map((o) => (
              <div key={o.id} className={`rounded-2xl border p-4 ${p.chosenOutlineId === o.id ? "border-zinc-900 dark:border-zinc-100" : "border-black/[.06] dark:border-white/[.08]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{o.title}</p>
                    <p className="mt-0.5 text-xs text-zinc-400">{o.rationale} · {o.source}</p>
                  </div>
                  <button type="button" onClick={() => chooseProjectOutline(p.id, o.id)} disabled={p.sections.length > 0 && p.chosenOutlineId !== o.id} title={p.sections.length > 0 && p.chosenOutlineId !== o.id ? "Already drafting — remove sections to switch" : ""} className="shrink-0 rounded-full border border-black/[.12] px-3 py-1.5 text-xs disabled:opacity-30 dark:border-white/[.15]">
                    {p.chosenOutlineId === o.id ? "Chosen" : "Choose"}
                  </button>
                </div>
                <ol className="mt-2 list-decimal pl-5 text-xs text-zinc-500">
                  {o.sections.map((s, i) => <li key={i}>{s.heading}</li>)}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sections */}
      {p.sections.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">3 · Draft, one section at a time</h2>
          <div className="mb-3">
            <FreshnessBadge state={state} fingerprint={p.fingerprint} currentIds={projectDeps(p)} onRerun={() => markProjectReviewed(p.id)} approxAiCalls={0} />
          </div>
          <div className="flex flex-col gap-4">
            {sortedSections.map((s) => <AuthoringSection key={s.id} project={p} section={s} />)}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder="Add a section…" className="flex-1 rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none dark:border-white/[.12]" />
            <button type="button" onClick={() => { if (newSection.trim()) { addProjectSection(p.id, newSection); setNewSection(""); } }} disabled={!newSection.trim()} className="rounded-full border border-black/[.12] px-4 py-2 text-sm disabled:opacity-30 dark:border-white/[.15]">Add</button>
          </div>
        </section>
      )}

      {/* Citations */}
      {p.sections.some((s) => s.paragraphs.length > 0) && coverage && (
        <section className="mb-8">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Citations</h2>
          <p className="text-xs text-zinc-400">{coverage.used} of {coverage.assembled} assembled records cited · {unsupported.length} unsupported paragraph{unsupported.length === 1 ? "" : "s"}.</p>
          {unsupported.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-amber-700 dark:text-amber-300">
              {unsupported.slice(0, 8).map((u) => <li key={u.paragraphId}>In “{u.heading}”: {snippet(u.text, 80)}</li>)}
            </ul>
          )}
        </section>
      )}

      {/* Export */}
      <section className="mb-8">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">4 · Export</h2>
        <p className="mb-2 text-xs text-zinc-400">Deterministic export — citations preserved as a numbered reference list in every format.</p>
        <ExportBar project={p} />
      </section>

      {/* Project history */}
      {p.history.length > 0 && (
        <section className="text-xs text-zinc-400">
          <h2 className="mb-1 font-semibold uppercase tracking-wide">History</h2>
          <ul className="flex flex-col gap-0.5">
            {[...p.history].reverse().slice(0, 15).map((h, i) => <li key={i}>{new Date(h.at).toLocaleDateString()} — {h.note} ({h.source})</li>)}
          </ul>
        </section>
      )}
    </main>
  );
}
