/**
 * Deterministic tension detection (LIFEOS-018, Phase 7).
 *
 * Surfaces structural problems in the concept graph — isolated concepts,
 * unsupported concepts, duplicates, circular definitions, contradictory
 * principles, and framework overlap. Every tension carries an explicit reason.
 * NOTHING is resolved automatically; these are invitations for the user to
 * look. Pure and offline.
 */

import type { StoreState, WorldTension } from "@/types/mvp";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function words(s: string): Set<string> {
  return new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / Math.min(a.size, b.size);
}

export function detectTensions(state: StoreState): WorldTension[] {
  const out: WorldTension[] = [];
  const concepts = state.concepts.filter((c) => c.status !== "archived");
  const approvedRels = state.conceptRelationships.filter((r) => r.approved);

  // Concept ids touched by any approved relationship or cross-type link.
  const connected = new Set<string>();
  for (const r of approvedRels) { connected.add(r.fromConceptId); connected.add(r.toConceptId); }

  for (const c of concepts) {
    const hasCrossLinks = c.relatedBeliefs.length + c.relatedThreads.length + c.relatedSources.length + c.relatedPractices.length > 0;
    const hasGraphLinks = connected.has(c.id) || c.parentConcepts.length + c.childConcepts.length + c.relatedConcepts.length + c.opposingConcepts.length > 0;

    // Isolated: no relationships and no cross-type links at all.
    if (!hasGraphLinks && !hasCrossLinks) {
      out.push({
        id: `tension:isolated:${c.id}`,
        kind: "isolated_concept",
        title: c.name,
        detail: "This concept has no relationships and no links to beliefs, threads, sources, or practices.",
        conceptIds: [c.id],
        href: `/world/concept/${c.id}`,
      });
    }

    // Unsupported: has no definition AND nothing grounds it.
    if (!c.definition.trim() && !hasCrossLinks) {
      out.push({
        id: `tension:unsupported:${c.id}`,
        kind: "unsupported_concept",
        title: c.name,
        detail: "No definition and nothing in your records grounds it yet.",
        conceptIds: [c.id],
        href: `/world/concept/${c.id}`,
      });
    }
  }

  // Duplicates: same normalized name/alias, or highly similar definitions.
  for (let i = 0; i < concepts.length; i++) {
    for (let j = i + 1; j < concepts.length; j++) {
      const a = concepts[i], b = concepts[j];
      const namesA = new Set([norm(a.name), ...a.aliases.map(norm)]);
      const namesB = new Set([norm(b.name), ...b.aliases.map(norm)]);
      const nameClash = [...namesA].some((n) => namesB.has(n));
      const defClose = a.definition && b.definition && overlap(words(a.definition), words(b.definition)) >= 0.6;
      if (nameClash || defClose) {
        out.push({
          id: `tension:dup:${a.id}:${b.id}`,
          kind: "duplicate_concept",
          title: `“${a.name}” and “${b.name}”`,
          detail: nameClash ? "These share a name or alias — they may be the same concept." : "Their definitions are very similar — consider merging.",
          conceptIds: [a.id, b.id],
          href: `/world/concept/${a.id}`,
        });
      }
    }
  }

  // Circular definitions: A's definition names B and B's definition names A,
  // or a parent/child cycle between two concepts.
  const byId = new Map(state.concepts.map((c) => [c.id, c]));
  for (const c of concepts) {
    for (const pid of c.parentConcepts) {
      const p = byId.get(pid);
      if (p && p.parentConcepts.includes(c.id)) {
        out.push({
          id: `tension:circ:${[c.id, pid].sort().join(":")}`,
          kind: "circular_definition",
          title: `“${c.name}” ↔ “${p.name}”`,
          detail: "Each is marked a parent of the other — the hierarchy is circular.",
          conceptIds: [c.id, pid],
          href: `/world/concept/${c.id}`,
        });
      }
    }
    // Definition name-reference cycle.
    for (const other of concepts) {
      if (other.id === c.id) continue;
      const cNamesOther = norm(c.definition).includes(norm(other.name));
      const otherNamesC = norm(other.definition).includes(norm(c.name));
      if (cNamesOther && otherNamesC && c.id < other.id) {
        out.push({
          id: `tension:circdef:${c.id}:${other.id}`,
          kind: "circular_definition",
          title: `“${c.name}” ↔ “${other.name}”`,
          detail: "Each concept's definition is stated in terms of the other.",
          conceptIds: [c.id, other.id],
          href: `/world/concept/${c.id}`,
        });
      }
    }
  }

  // Contradictory principles: a belief that derives from two principles whose
  // supporting concepts are marked as opposing.
  const opposingPairs = new Set<string>();
  for (const c of concepts) for (const oid of c.opposingConcepts) opposingPairs.add([c.id, oid].sort().join(":"));
  for (const belief of state.beliefs) {
    const derivedFrom = state.principles.filter((p) => p.beliefIds.includes(belief.id));
    for (let i = 0; i < derivedFrom.length; i++) {
      for (let j = i + 1; j < derivedFrom.length; j++) {
        const pa = derivedFrom[i], pb = derivedFrom[j];
        const clash = pa.conceptIds.some((x) => pb.conceptIds.some((y) => opposingPairs.has([x, y].sort().join(":"))));
        if (clash) {
          out.push({
            id: `tension:princ:${pa.id}:${pb.id}`,
            kind: "contradictory_principle",
            title: `“${pa.statement.slice(0, 40)}” vs “${pb.statement.slice(0, 40)}”`,
            detail: `A belief derives from both, but they rest on opposing concepts.`,
            conceptIds: [...pa.conceptIds, ...pb.conceptIds],
          });
        }
      }
    }
  }

  // Framework overlap: two frameworks sharing ≥3 concepts (or ≥60%).
  const fw = state.frameworks.filter((f) => f.status !== "archived");
  for (let i = 0; i < fw.length; i++) {
    for (let j = i + 1; j < fw.length; j++) {
      const a = fw[i], b = fw[j];
      const shared = a.conceptIds.filter((x) => b.conceptIds.includes(x));
      const frac = shared.length / Math.max(1, Math.min(a.conceptIds.length, b.conceptIds.length));
      if (shared.length >= 3 || (shared.length >= 2 && frac >= 0.6)) {
        out.push({
          id: `tension:fw:${a.id}:${b.id}`,
          kind: "framework_overlap",
          title: `“${a.name}” and “${b.name}”`,
          detail: `Share ${shared.length} concept${shared.length === 1 ? "" : "s"} — are they distinct, or is one a lens on the other?`,
          conceptIds: shared,
        });
      }
    }
  }

  return out;
}
