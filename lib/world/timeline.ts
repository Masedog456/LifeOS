/**
 * Concept-evolution timeline (LIFEOS-018, Phase 8).
 *
 * A DERIVED, read-only, chronological view of how the world model changed —
 * concept definition/relationship/principle/framework revisions, relationship
 * approvals, and framework/principle creation. Built fresh from append-only
 * history each render; never stored, never editable, deduped by stable id.
 */

import type { StoreState, WorldTimelineItem } from "@/types/mvp";

function snippet(s: string, n = 90): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

export function buildWorldTimeline(state: StoreState, limit = 200): WorldTimelineItem[] {
  const items: WorldTimelineItem[] = [];

  for (const c of state.concepts) {
    for (let i = 0; i < c.history.length; i++) {
      const h = c.history[i];
      items.push({
        id: `c:${c.id}:${i}`,
        at: h.at,
        kind: h.kind,
        title: `${c.name} — ${h.note}`,
        href: `/world/concept/${c.id}`,
      });
    }
  }

  for (const r of state.conceptRelationships) {
    if (!r.approved) continue;
    const from = state.concepts.find((c) => c.id === r.fromConceptId)?.name ?? "?";
    const to = state.concepts.find((c) => c.id === r.toConceptId)?.name ?? "?";
    items.push({
      id: `r:${r.id}`,
      at: r.updatedAt,
      kind: "relationship_approved",
      title: `${from} ${r.type.replace(/_/g, " ")} ${to}`,
      detail: snippet(r.reason),
      href: `/world/concept/${r.fromConceptId}`,
    });
  }

  for (const p of state.principles) {
    items.push({
      id: `p:${p.id}`,
      at: p.createdAt,
      kind: "principle",
      title: `Principle: ${snippet(p.statement, 70)}`,
    });
  }

  for (const f of state.frameworks) {
    items.push({
      id: `f:${f.id}`,
      at: f.createdAt,
      kind: "framework",
      title: `${f.kind}: ${f.name}`,
    });
  }

  const seen = new Set<string>();
  return items
    .filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, limit);
}
