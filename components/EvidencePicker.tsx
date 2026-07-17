"use client";

import type { ProjectAssembly, StoreState } from "@/types/mvp";

/** The per-field toggle labels for the whole assembly, derived from the store. */
export function pickAssemblyItems(state: StoreState): Record<keyof ProjectAssembly, { id: string; label: string }[]> {
  const s = (t: string, n = 30) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t);
  return {
    sourceIds: state.sources.map((x) => ({ id: x.id, label: s(x.title) })),
    beliefIds: state.beliefs.filter((b) => b.status !== "rejected").map((b) => ({ id: b.id, label: s(b.text) })),
    conceptIds: state.concepts.map((c) => ({ id: c.id, label: s(c.name) })),
    threadIds: state.megathreads.map((t) => ({ id: t.id, label: s(t.title) })),
    reasoningIds: state.reasonings.map((q) => ({ id: q.id, label: s(q.question) })),
    frameworkIds: state.frameworks.map((f) => ({ id: f.id, label: s(f.name) })),
    principleIds: state.principles.map((p) => ({ id: p.id, label: s(p.statement) })),
    formationIds: state.formationSessions.map((f) => ({ id: f.id, label: s(f.title) })),
    decisionIds: state.decisions.map((d) => ({ id: d.id, label: s(d.title) })),
  };
}

/** The nine assembly fields with human labels, in display order. */
export const ASSEMBLY_FIELDS: { field: keyof ProjectAssembly; label: string }[] = [
  { field: "sourceIds", label: "Sources" },
  { field: "beliefIds", label: "Beliefs" },
  { field: "conceptIds", label: "Concepts" },
  { field: "threadIds", label: "Threads" },
  { field: "reasoningIds", label: "Reasonings" },
  { field: "frameworkIds", label: "Frameworks" },
  { field: "principleIds", label: "Principles" },
  { field: "formationIds", label: "Reflections" },
  { field: "decisionIds", label: "Decisions" },
];

/**
 * A shared toggle list for one evidence type (LIFEOS-020). Reused by the
 * Authoring Engine and the Research Workspace so the evidence-selection UI is
 * defined once. Attaches REFERENCES to existing records — never copies.
 */
export default function EvidencePicker({
  field, label, selected, items, onToggle,
}: {
  field: keyof ProjectAssembly;
  label: string;
  selected: string[];
  items: { id: string; label: string }[];
  onToggle: (field: keyof ProjectAssembly, id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{label} ({selected.length}/{items.length})</h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <button key={it.id} type="button" onClick={() => onToggle(field, it.id)} className={`rounded-full px-2.5 py-1 text-[11px] ${selected.includes(it.id) ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-black/[.12] text-zinc-500 dark:border-white/[.15]"}`}>
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}
