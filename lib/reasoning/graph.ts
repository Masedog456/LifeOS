/**
 * Deterministic reasoning graph (LIFEOS-014, Phase 3).
 *
 * A temporary, INTERNAL structure over existing records — never rendered as a
 * graph and never duplicating source text. Nodes and edges keep provenance so
 * the deterministic passes and the AI packet can cite real record ids. Scope
 * is resolved deterministically and expanded conservatively from a selection.
 */

import type {
  EvidenceItem,
  ReasoningEdge,
  ReasoningNode,
  ReasoningScope,
  StoreState,
} from "@/types/mvp";

export const MAX_SCOPE_SOURCES = 25;
export const MAX_EVIDENCE = 60;

function snippet(s: string, n = 90): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

export interface ResolvedScope {
  sourceIds: Set<string>;
  beliefIds: Set<string>;
  threadIds: Set<string>;
  comparisonIds: Set<string>;
  inquiryIds: Set<string>;
}

/** Resolve a scope to concrete id sets, expanding conservatively from a selection. */
export function resolveScope(state: StoreState, scope: ReasoningScope): ResolvedScope {
  const all: ResolvedScope = {
    sourceIds: new Set(state.sources.map((s) => s.id)),
    beliefIds: new Set(state.beliefs.map((b) => b.id)),
    threadIds: new Set(state.megathreads.map((t) => t.id)),
    comparisonIds: new Set(state.comparisons.map((c) => c.id)),
    inquiryIds: new Set(state.inquiries.map((i) => i.id)),
  };
  if (scope.kind === "all") return all;

  const r: ResolvedScope = {
    sourceIds: new Set(scope.sourceIds ?? []),
    beliefIds: new Set(scope.beliefIds ?? []),
    threadIds: new Set(scope.threadIds ?? []),
    comparisonIds: new Set(scope.comparisonIds ?? []),
    inquiryIds: new Set(scope.inquiryIds ?? []),
  };

  // Expand: sources ⇄ beliefs (via captures), and comparisons/inquiries/threads
  // that touch anything already selected.
  const captureSource = new Map(state.captures.map((c) => [c.id, c.sourceId]));
  for (const b of state.beliefs) {
    if (!r.beliefIds.has(b.id)) continue;
    const src = captureSource.get(b.captureId);
    if (src) r.sourceIds.add(src);
  }
  for (const b of state.beliefs) {
    const src = captureSource.get(b.captureId);
    if (src && r.sourceIds.has(src)) r.beliefIds.add(b.id);
  }
  for (const c of state.comparisons) {
    if (c.sourceIds.some((x) => r.sourceIds.has(x)) || c.beliefIds.some((x) => r.beliefIds.has(x))) r.comparisonIds.add(c.id);
  }
  for (const i of state.inquiries) {
    if (i.sourceIds.some((x) => r.sourceIds.has(x)) || i.beliefIds.some((x) => r.beliefIds.has(x))) r.inquiryIds.add(i.id);
  }
  for (const t of state.megathreads) {
    if (t.members.some((m) => (m.type === "source" && r.sourceIds.has(m.id)) || (m.type === "belief" && r.beliefIds.has(m.id)))) {
      r.threadIds.add(t.id);
    }
  }
  return r;
}

export interface ReasoningGraph {
  nodes: ReasoningNode[];
  edges: ReasoningEdge[];
  evidence: EvidenceItem[];
  resolved: ResolvedScope;
}

/** Build the graph + a capped evidence packet (evidence ids ARE record ids). */
export function buildReasoningGraph(state: StoreState, scope: ReasoningScope): ReasoningGraph {
  const resolved = resolveScope(state, scope);
  const nodes: ReasoningNode[] = [];
  const edges: ReasoningEdge[] = [];
  const evidence: EvidenceItem[] = [];
  const nodeIds = new Set<string>();

  const addNode = (n: ReasoningNode) => {
    if (nodeIds.has(n.id)) return;
    nodeIds.add(n.id);
    nodes.push(n);
  };
  const addEdge = (from: string, to: string, type: ReasoningEdge["type"]) => {
    if (nodeIds.has(from) && nodeIds.has(to)) edges.push({ from, to, type });
  };
  const addEvidence = (id: string, kind: EvidenceItem["kind"], group: string, text: string) => {
    if (!evidence.some((e) => e.id === id)) evidence.push({ id, kind, group, text });
  };

  for (const s of state.sources) {
    if (!resolved.sourceIds.has(s.id)) continue;
    addNode({ id: `source:${s.id}`, type: "source", refId: s.id, label: s.title, at: s.addedAt });
    addEvidence(s.id, "metadata", "Source", `${s.title}${s.summary ? ` — ${snippet(s.summary)}` : ""}`);
  }
  for (const c of state.captures) {
    if (!c.sourceId || !resolved.sourceIds.has(c.sourceId)) continue;
    addNode({ id: `capture:${c.id}`, type: "capture", refId: c.id, label: snippet(c.text), at: c.createdAt });
    addEdge(`capture:${c.id}`, `source:${c.sourceId}`, "derived_from");
  }
  for (const b of state.beliefs) {
    if (!resolved.beliefIds.has(b.id)) continue;
    addNode({ id: `belief:${b.id}`, type: "belief", refId: b.id, label: snippet(b.text), at: b.updatedAt });
    addEvidence(b.id, "belief", "Belief", `${b.text} (${b.status})`);
    const cap = state.captures.find((c) => c.id === b.captureId);
    if (cap) addEdge(`belief:${b.id}`, `capture:${cap.id}`, "derived_from");
    for (let i = 1; i < b.revisions.length; i++) {
      const rid = `revision:${b.id}:${i}`;
      addNode({ id: rid, type: "revision", refId: b.id, label: snippet(b.revisions[i].text), at: b.revisions[i].at });
      addEdge(rid, `belief:${b.id}`, "revised_from");
    }
  }
  for (const c of state.comparisons) {
    if (!resolved.comparisonIds.has(c.id)) continue;
    addNode({ id: `comparison:${c.id}`, type: "comparison", refId: c.id, label: snippet(c.title), at: c.createdAt });
    addEvidence(c.id, "comparison_finding", "Comparison", `${c.title}: ${c.result.disagreements.length} disagreement(s), ${c.result.agreements.length} agreement(s)`);
    for (const sid of c.sourceIds) addEdge(`comparison:${c.id}`, `source:${sid}`, "compared_with");
    for (const bid of c.beliefIds) addEdge(`comparison:${c.id}`, `belief:${bid}`, "references");
  }
  for (const i of state.inquiries) {
    if (!resolved.inquiryIds.has(i.id)) continue;
    addNode({ id: `inquiry:${i.id}`, type: "inquiry", refId: i.id, label: snippet(i.question), at: i.updatedAt });
    addEvidence(i.id, "comparison_finding", "Inquiry", `${i.question} (${i.status})`);
    for (const sid of i.sourceIds) addEdge(`inquiry:${i.id}`, `source:${sid}`, "investigated_by");
    for (const bid of i.beliefIds) addEdge(`inquiry:${i.id}`, `belief:${bid}`, "references");
  }
  for (const t of state.megathreads) {
    if (!resolved.threadIds.has(t.id)) continue;
    addNode({ id: `megathread:${t.id}`, type: "megathread", refId: t.id, label: snippet(t.title), at: t.updatedAt });
    addEvidence(t.id, "metadata", "Thread", t.title);
    for (const m of t.members) addEdge(`megathread:${t.id}`, `${m.type}:${m.id}`, "belongs_to");
  }
  for (const r of state.reflections) {
    if (!(r.beliefIds ?? []).some((b) => resolved.beliefIds.has(b)) && !(r.threadIds ?? []).some((t) => resolved.threadIds.has(t))) continue;
    addNode({ id: `reflection:${r.id}`, type: "reflection", refId: r.id, label: snippet(r.response), at: r.createdAt });
    addEvidence(r.id, "belief", "Reflection", snippet(r.response, 160));
    for (const b of r.beliefIds ?? []) addEdge(`reflection:${r.id}`, `belief:${b}`, "references");
  }
  for (const p of state.practices) {
    const bIds = p.derivedFrom.beliefIds ?? [];
    const tIds = p.derivedFrom.threadIds ?? [];
    if (!bIds.some((b) => resolved.beliefIds.has(b)) && !tIds.some((t) => resolved.threadIds.has(t))) continue;
    addNode({ id: `practice:${p.id}`, type: "practice", refId: p.id, label: snippet(p.userWording || p.title), at: p.updatedAt });
    for (const b of bIds) addEdge(`practice:${p.id}`, `belief:${b}`, "derived_from");
  }

  return { nodes, edges, evidence: evidence.slice(0, MAX_EVIDENCE), resolved };
}
