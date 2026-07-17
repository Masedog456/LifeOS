/**
 * Deterministic concept extraction (LIFEOS-018, Phase 4).
 *
 * Gathers concept CANDIDATES from the material the user already has — source
 * key-concepts, belief themes, concept-seeded Megathreads, and reasoning
 * scopes — with the records that mention each. These are surfaced for review,
 * never turned into concepts automatically. Also builds a capped, provenance-
 * bearing evidence packet the AI proposer cites by id. Pure and offline.
 */

import type { Concept, EvidenceItem, StoreState, WorldProposal } from "@/types/mvp";

export const MAX_WORLD_EVIDENCE = 40;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Names + aliases already modeled, normalized — used to skip known concepts. */
function knownNames(state: StoreState): Set<string> {
  const set = new Set<string>();
  for (const c of state.concepts) {
    set.add(norm(c.name));
    for (const a of c.aliases) set.add(norm(a));
  }
  return set;
}

export interface ConceptCandidate {
  name: string;
  count: number;
  /** Where it appears (record ids), for provenance. */
  recordIds: string[];
  reason: string;
}

/**
 * Concept candidates NOT yet modeled, ordered by how often they recur. A
 * candidate must appear at least twice (or be a concept-seeded thread) to
 * surface — single mentions are noise.
 */
export function deterministicConceptCandidates(state: StoreState): ConceptCandidate[] {
  const known = knownNames(state);
  const agg = new Map<string, { count: number; recordIds: Set<string>; label: string }>();

  const bump = (raw: string, recordId: string) => {
    const key = norm(raw);
    if (!key || key.length < 3 || known.has(key)) return;
    const cur = agg.get(key) ?? { count: 0, recordIds: new Set<string>(), label: raw.trim() };
    cur.count++;
    cur.recordIds.add(recordId);
    agg.set(key, cur);
  };

  for (const s of state.sources) for (const c of s.keyConcepts ?? []) bump(c, s.id);
  for (const b of state.beliefs) if (b.theme) bump(b.theme, b.id);
  for (const t of state.megathreads) if (t.seedType === "concept" && t.seedLabel) bump(t.seedLabel, t.id);

  const out: ConceptCandidate[] = [];
  for (const [, v] of agg) {
    const isThreadSeed = state.megathreads.some((t) => t.seedType === "concept" && norm(t.seedLabel ?? "") === norm(v.label));
    if (v.count < 2 && !isThreadSeed) continue;
    out.push({
      name: v.label,
      count: v.count,
      recordIds: [...v.recordIds],
      reason: `Appears in ${v.recordIds.size} of your records${isThreadSeed ? " and seeds a Megathread" : ""}.`,
    });
  }
  return out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 30);
}

/** Deterministic proposals that need no AI: unmodeled recurring concepts + missing definitions. */
export function deterministicProposals(state: StoreState): WorldProposal[] {
  const out: WorldProposal[] = [];
  for (const cand of deterministicConceptCandidates(state).slice(0, 12)) {
    out.push({
      kind: "new_concept",
      statement: `“${cand.name}” recurs in your material but isn't a concept yet.`,
      concepts: [cand.name],
      citations: cand.recordIds,
    });
  }
  for (const c of state.concepts) {
    if (!c.definition.trim()) {
      out.push({
        kind: "missing_definition",
        statement: `“${c.name}” has no definition yet.`,
        concepts: [c.id],
        citations: [],
      });
    }
  }
  return out;
}

function snippet(s: string, n = 220): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

/** Evidence packet for the AI proposer — evidence ids ARE real record ids. */
export function buildWorldEvidence(state: StoreState): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  for (const c of state.concepts.slice(0, 20)) {
    out.push({ id: c.id, kind: "concept", group: "Concept", text: `${c.name}${c.definition ? `: ${snippet(c.definition, 160)}` : " (no definition)"}` });
  }
  for (const b of state.beliefs.filter((b) => b.status !== "rejected").slice(0, 12)) {
    out.push({ id: b.id, kind: "belief", group: "Belief", text: `${snippet(b.text, 160)}${b.theme ? ` [theme: ${b.theme}]` : ""}` });
  }
  for (const s of state.sources.slice(0, 8)) {
    const concepts = (s.keyConcepts ?? []).slice(0, 6).join(", ");
    out.push({ id: s.id, kind: "metadata", group: "Source", text: `${s.title}${concepts ? ` — concepts: ${concepts}` : ""}` });
  }
  for (const t of state.megathreads.slice(0, 6)) {
    out.push({ id: t.id, kind: "metadata", group: "Thread", text: `${t.title}. ${snippet(t.synthesis?.currentUnderstanding ?? t.description ?? "", 140)}` });
  }
  for (const p of state.principles.slice(0, 6)) {
    out.push({ id: p.id, kind: "claim", group: "Principle", text: snippet(p.statement, 160) });
  }
  return out.slice(0, MAX_WORLD_EVIDENCE);
}

/** The text the world model is "about" — for freshness/ranking. */
export function conceptText(c: Concept): string {
  return [c.name, ...c.aliases, c.definition, c.description, ...c.questions].join(" · ");
}
