/**
 * Deterministic knowledge assembly (LIFEOS-019, Phase 3).
 *
 * Resolves a project's chosen evidence (across every record type) into a flat,
 * provenance-bearing packet. Evidence ids ARE real record ids, so citations
 * validate and freshness fingerprints resolve. Pure and offline; never
 * fabricates, never pulls in unchosen records.
 */

import type { KnowledgeProject, ProjectAssembly, ProjectEvidence, StoreState } from "@/types/mvp";

function snippet(s: string, n = 240): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

export function emptyAssembly(): ProjectAssembly {
  return {
    sourceIds: [], beliefIds: [], conceptIds: [], threadIds: [], reasoningIds: [],
    frameworkIds: [], principleIds: [], formationIds: [], decisionIds: [],
  };
}

/** Resolve the chosen evidence into a flat packet with provenance. */
export function assembleEvidence(state: StoreState, a: ProjectAssembly): ProjectEvidence[] {
  const out: ProjectEvidence[] = [];

  for (const id of a.sourceIds) {
    const s = state.sources.find((x) => x.id === id);
    if (s) out.push({ id, kind: "source", label: s.title, text: snippet([s.title, s.author, s.summary].filter(Boolean).join(" — ")) });
  }
  for (const id of a.beliefIds) {
    const b = state.beliefs.find((x) => x.id === id);
    if (b) out.push({ id, kind: "belief", label: snippet(b.text, 50), text: `${b.text} (${b.status})` });
  }
  for (const id of a.conceptIds) {
    const c = state.concepts.find((x) => x.id === id);
    if (c) out.push({ id, kind: "concept", label: c.name, text: snippet(`${c.name}: ${c.definition || c.description || "(no definition)"}`) });
  }
  for (const id of a.threadIds) {
    const t = state.megathreads.find((x) => x.id === id);
    if (t) out.push({ id, kind: "thread", label: snippet(t.title, 50), text: snippet(`${t.title}. ${t.synthesis?.currentUnderstanding ?? t.description ?? ""}`) });
  }
  for (const id of a.reasoningIds) {
    const q = state.reasonings.find((x) => x.id === id);
    if (q) out.push({ id, kind: "reasoning", label: snippet(q.question, 50), text: snippet(`${q.question} (${q.mode})`) });
  }
  for (const id of a.frameworkIds) {
    const f = state.frameworks.find((x) => x.id === id);
    if (f) out.push({ id, kind: "framework", label: f.name, text: snippet(`${f.kind}: ${f.name}. ${f.description}`) });
  }
  for (const id of a.principleIds) {
    const p = state.principles.find((x) => x.id === id);
    if (p) out.push({ id, kind: "principle", label: snippet(p.statement, 50), text: snippet(p.statement) });
  }
  for (const id of a.formationIds) {
    const s = state.formationSessions.find((x) => x.id === id);
    if (s) out.push({ id, kind: "formation", label: snippet(s.title, 50), text: snippet(`${s.title}: ${s.reflection}`) });
  }
  for (const id of a.decisionIds) {
    const d = state.decisions.find((x) => x.id === id);
    if (d) {
      const chosen = d.finalChoice ? d.options.find((o) => o.id === d.finalChoice)?.name : undefined;
      out.push({ id, kind: "decision", label: snippet(d.title, 50), text: snippet(`${d.title}: ${d.question}${chosen ? ` — chose “${chosen}”` : ""}`) });
    }
  }
  return out;
}

/** All chosen evidence ids (flat), for freshness deps. */
export function assemblyIds(a: ProjectAssembly): string[] {
  return [
    ...a.sourceIds, ...a.beliefIds, ...a.conceptIds, ...a.threadIds, ...a.reasoningIds,
    ...a.frameworkIds, ...a.principleIds, ...a.formationIds, ...a.decisionIds,
  ];
}

export function assemblyCount(a: ProjectAssembly): number {
  return assemblyIds(a).length;
}

/** Convenience: the assembled packet for a whole project. */
export function projectEvidence(state: StoreState, p: KnowledgeProject): ProjectEvidence[] {
  return assembleEvidence(state, p.assembly);
}
