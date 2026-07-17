/**
 * Research gap detection (LIFEOS-020, Phase 8).
 *
 * Deterministically surfaces holes in an investigation — unsupported claims,
 * missing evidence, contradictory evidence, duplicate evidence, orphan
 * questions, and unresolved hypotheses. Every gap carries an explicit reason.
 * NOTHING is resolved automatically; these are invitations to look. Pure and
 * offline.
 */

import type { ResearchGap, ResearchProject, StoreState } from "@/types/mvp";
import { assemblyIds } from "@/lib/authoring/assembly";

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
function snippet(s: string, n = 60): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

export function detectResearchGaps(state: StoreState, p: ResearchProject): ResearchGap[] {
  const out: ResearchGap[] = [];
  const evidenceIds = new Set(assemblyIds(p.assembly));

  // Incoming edges by target node.
  const incoming = new Map<string, { kind: string; fromKind: string }[]>();
  const nodeById = new Map(p.argumentNodes.map((n) => [n.id, n]));
  for (const e of p.argumentEdges) {
    const from = nodeById.get(e.fromId);
    if (!from) continue;
    const arr = incoming.get(e.toId) ?? [];
    arr.push({ kind: e.kind, fromKind: from.kind });
    incoming.set(e.toId, arr);
  }

  // 1) Unsupported claims: a claim node with no incoming "supports" edge from evidence.
  for (const n of p.argumentNodes) {
    if (n.kind !== "claim") continue;
    const inc = incoming.get(n.id) ?? [];
    const supported = inc.some((i) => i.kind === "supports" && (i.fromKind === "evidence" || i.fromKind === "claim"));
    if (!supported) {
      out.push({ id: `gap:unsupported:${n.id}`, kind: "unsupported_claim", title: snippet(n.text), detail: "This claim has no supporting evidence edge in the argument map.", refs: [n.id] });
    }
  }

  // 2) Missing evidence: a subquestion/unknown with no linked hypothesis or argument node.
  const referencedText = [
    ...p.hypotheses.flatMap((h) => [h.statement, ...h.openQuestions]),
    ...p.argumentNodes.map((n) => n.text),
  ].map(norm);
  for (const q of [...p.questions.subquestions, ...p.questions.unknowns]) {
    if (q.resolved) continue;
    const qw = words(q.text);
    const touched = referencedText.some((t) => overlap(qw, words(t)) >= 0.3);
    if (!touched && evidenceIds.size === 0) {
      out.push({ id: `gap:missing:${q.id}`, kind: "missing_evidence", title: snippet(q.text), detail: "No evidence is attached and nothing addresses this question yet.", refs: [q.id] });
    } else if (!touched) {
      out.push({ id: `gap:missing:${q.id}`, kind: "missing_evidence", title: snippet(q.text), detail: "No hypothesis or argument addresses this open question yet.", refs: [q.id] });
    }
  }

  // 3) Contradictory evidence: a record cited as BOTH supporting and contradicting
  // (within one hypothesis, or across hypotheses).
  const support = new Map<string, string[]>();
  const contra = new Map<string, string[]>();
  for (const h of p.hypotheses) {
    for (const eid of h.supportingEvidence) support.set(eid, [...(support.get(eid) ?? []), h.id]);
    for (const eid of h.contradictingEvidence) contra.set(eid, [...(contra.get(eid) ?? []), h.id]);
  }
  for (const eid of support.keys()) {
    if (contra.has(eid)) {
      out.push({ id: `gap:contra:${eid}`, kind: "contradictory_evidence", title: `A record is cited both for and against`, detail: "The same evidence supports one hypothesis and contradicts another — resolve how it actually bears.", refs: [eid] });
    }
  }

  // 4) Duplicate evidence: the same record attached as evidence in two argument nodes,
  // or near-identical hypothesis statements.
  const evNodesByRecord = new Map<string, string[]>();
  for (const n of p.argumentNodes) {
    if (n.kind === "evidence" && n.recordId) evNodesByRecord.set(n.recordId, [...(evNodesByRecord.get(n.recordId) ?? []), n.id]);
  }
  for (const [rid, nodes] of evNodesByRecord) {
    if (nodes.length > 1) {
      out.push({ id: `gap:dup:${rid}`, kind: "duplicate_evidence", title: "The same record appears as evidence more than once", detail: `${nodes.length} argument nodes point at the same record — consolidate.`, refs: nodes });
    }
  }
  for (let i = 0; i < p.hypotheses.length; i++) {
    for (let j = i + 1; j < p.hypotheses.length; j++) {
      if (overlap(words(p.hypotheses[i].statement), words(p.hypotheses[j].statement)) >= 0.7) {
        out.push({ id: `gap:duph:${p.hypotheses[i].id}:${p.hypotheses[j].id}`, kind: "duplicate_evidence", title: "Two hypotheses are nearly identical", detail: "Consider merging or sharpening the distinction.", refs: [p.hypotheses[i].id, p.hypotheses[j].id] });
      }
    }
  }

  // 5) Orphan questions: open problems not touched by any hypothesis or argument.
  for (const q of p.questions.openProblems) {
    if (q.resolved) continue;
    const qw = words(q.text);
    const touched = referencedText.some((t) => overlap(qw, words(t)) >= 0.3);
    if (!touched) {
      out.push({ id: `gap:orphan:${q.id}`, kind: "orphan_question", title: snippet(q.text), detail: "This open problem is not connected to any hypothesis or argument.", refs: [q.id] });
    }
  }

  // 6) Unresolved hypotheses: still proposed/active with open questions or no evidence either way.
  for (const h of p.hypotheses) {
    if (h.status !== "proposed" && h.status !== "active") continue;
    const noEvidence = h.supportingEvidence.length === 0 && h.contradictingEvidence.length === 0;
    if (noEvidence || h.openQuestions.length > 0) {
      out.push({
        id: `gap:hyp:${h.id}`,
        kind: "unresolved_hypothesis",
        title: snippet(h.statement),
        detail: noEvidence ? "No evidence yet weighs for or against this hypothesis." : `${h.openQuestions.length} open question${h.openQuestions.length === 1 ? "" : "s"} remain before it can be judged.`,
        refs: [h.id],
      });
    }
  }

  const seen = new Set<string>();
  return out.filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)));
}
