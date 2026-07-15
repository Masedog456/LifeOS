/**
 * Deterministic reasoning passes (LIFEOS-014, Phase 4).
 *
 * These run BEFORE any AI and produce the grounded parts of the result — every
 * finding cites real record ids. No truth scores. Tensions are classified
 * cautiously (a definitional difference is not a logical contradiction).
 * Nothing here mutates any record.
 */

import type {
  ContradictionKind,
  InfluenceChain,
  PositionEvidence,
  ReasoningFinding,
  ReasoningTension,
  StoreState,
  SupportAudit,
} from "@/types/mvp";
import type { ResolvedScope } from "@/lib/reasoning/graph";
import { cosine, localEmbed } from "@/lib/embeddings/local";
import { hasSemanticIndex } from "@/lib/retrieval/semantic";

const STOP = new Set([
  "the","and","for","are","but","not","you","that","this","with","from","have","what",
  "your","they","them","into","when","will","would","there","their","about","which","were",
  "been","some","such","is","of","a","to","in","on","or","an","be","it","as","do","i","my",
  "believe","think","should","would","could","must","more","less","most","kind","form",
]);
const NEGATION = /\b(not|no|never|isn't|aren't|cannot|can't|without|nor|un|dis)\b/i;

function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t)));
}
function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}
function snippet(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

// ---------------- Support audit ----------------

export function supportAudit(
  state: StoreState,
  resolved: ResolvedScope,
): { audits: SupportAudit[]; supporting: PositionEvidence[]; challenging: PositionEvidence[]; unresolved: string[] } {
  const captureSource = new Map(state.captures.map((c) => [c.id, c.sourceId]));
  const audits: SupportAudit[] = [];
  const supporting: PositionEvidence[] = [];
  const challenging: PositionEvidence[] = [];
  const unresolvedSet = new Set<string>();

  for (const b of state.beliefs) {
    if (!resolved.beliefIds.has(b.id)) continue;

    const supSources = new Set<string>();
    const chSources = new Set<string>();
    const supIds: string[] = [b.id];
    const chIds: string[] = [];

    const originSource = captureSource.get(b.captureId);
    if (originSource) { supSources.add(originSource); supIds.push(originSource); }

    for (const c of state.comparisons) {
      if (!c.beliefIds.includes(b.id)) continue;
      if (c.result.agreements.length > 0) { c.sourceIds.forEach((s) => supSources.add(s)); supIds.push(c.id); }
      if (c.result.disagreements.length > 0) { c.sourceIds.forEach((s) => chSources.add(s)); chIds.push(c.id); }
    }
    for (const i of state.inquiries) {
      if (!i.beliefIds.includes(b.id)) continue;
      if (i.result.affirmativeCase.length > 0) { i.sourceIds.forEach((s) => supSources.add(s)); supIds.push(i.id); }
      if (i.result.negativeCase.length > 0 || i.status === "unresolved") { i.sourceIds.forEach((s) => chSources.add(s)); chIds.push(i.id); }
      if (i.status === "unresolved") unresolvedSet.add(i.question);
    }
    for (const t of state.megathreads) {
      if (t.members.some((m) => m.type === "belief" && m.id === b.id)) {
        t.unresolvedQuestions.filter((q) => !q.resolved).forEach((q) => unresolvedSet.add(q.text));
      }
    }

    const supQuotes = originSource ? (state.sources.find((s) => s.id === originSource)?.keyQuotes.length ?? 0) : 0;
    const types = new Set([...supSources].map((sid) => state.sources.find((s) => s.id === sid)?.type).filter(Boolean));

    audits.push({
      beliefId: b.id,
      beliefText: b.text,
      supportingSources: supSources.size,
      challengingSources: chSources.size,
      supportingQuotes: supQuotes,
      revisions: Math.max(0, b.revisions.length - 1),
      unresolvedQuestions: [...unresolvedSet].length,
      evidenceDiversity: types.size,
      evidenceIds: [...new Set(supIds)],
    });
    if (supSources.size > 0 || supQuotes > 0)
      supporting.push({ position: `Support for “${snippet(b.text)}”`, evidenceIds: [...new Set(supIds)] });
    if (chSources.size > 0)
      challenging.push({ position: `Challenge to “${snippet(b.text)}”`, evidenceIds: [...new Set(chIds)] });
  }
  return { audits, supporting, challenging, unresolved: [...unresolvedSet].slice(0, 10) };
}

// ---------------- Contradiction audit ----------------

export function contradictionAudit(state: StoreState, resolved: ResolvedScope): ReasoningTension[] {
  const out: ReasoningTension[] = [];
  const push = (statement: string, kind: ContradictionKind, evidenceIds: string[]) =>
    out.push({ statement, kind, evidenceIds });

  // Explicit comparison disagreements (already classified).
  for (const c of state.comparisons) {
    if (!resolved.comparisonIds.has(c.id)) continue;
    for (const d of c.result.disagreements.slice(0, 2)) {
      push(`In comparison “${snippet(c.title, 40)}”: ${d.statement}`, d.kind, [c.id]);
    }
  }
  // Inquiries holding both an affirmative and a negative reading.
  for (const i of state.inquiries) {
    if (!resolved.inquiryIds.has(i.id)) continue;
    if (i.result.affirmativeCase.length > 0 && i.result.negativeCase.length > 0) {
      push(`Inquiry “${snippet(i.question, 40)}” holds both affirmative and negative readings.`, "ambiguity", [i.id]);
    }
  }
  // Belief pairs: opposing polarity → possible contradiction. Candidate pairs
  // come from token overlap AND (when a semantic index exists) semantic
  // neighbours — but a tension is ONLY recorded when the polarity differs.
  // Semantic similarity alone never labels two beliefs contradictory.
  const beliefs = state.beliefs.filter((b) => resolved.beliefIds.has(b.id) && b.status !== "rejected");
  const semantic = hasSemanticIndex(state);
  const vecs = semantic ? beliefs.map((b) => localEmbed(b.text)) : [];
  for (let a = 0; a < beliefs.length; a++) {
    for (let b = a + 1; b < beliefs.length; b++) {
      const lexical = overlap(tokens(beliefs[a].text), tokens(beliefs[b].text)) >= 2;
      const semanticNeighbour = semantic && cosine(vecs[a], vecs[b]) >= 0.6;
      if (!lexical && !semanticNeighbour) continue;
      const na = NEGATION.test(beliefs[a].text), nb = NEGATION.test(beliefs[b].text);
      if (na !== nb) {
        push(
          `“${snippet(beliefs[a].text, 50)}” and “${snippet(beliefs[b].text, 50)}” address a shared topic but differ in polarity.`,
          "logical",
          [beliefs[a].id, beliefs[b].id],
        );
      }
    }
  }
  // Revision reversals within a single belief.
  for (const belief of beliefs) {
    for (let i = 1; i < belief.revisions.length; i++) {
      const prev = belief.revisions[i - 1].text, cur = belief.revisions[i].text;
      if (NEGATION.test(prev) !== NEGATION.test(cur) && overlap(tokens(prev), tokens(cur)) >= 2) {
        push(`Your view on “${snippet(belief.text, 40)}” reversed polarity over revisions.`, "historical", [belief.id]);
        break;
      }
    }
  }
  return out.slice(0, 20);
}

// ---------------- Influence trace ----------------

export function influenceTrace(state: StoreState, resolved: ResolvedScope, targetBeliefId?: string): InfluenceChain[] {
  const out: InfluenceChain[] = [];
  const beliefs = state.beliefs.filter((b) => (targetBeliefId ? b.id === targetBeliefId : resolved.beliefIds.has(b.id)));
  for (const b of beliefs) {
    const cap = state.captures.find((c) => c.id === b.captureId);
    const src = cap?.sourceId ? state.sources.find((s) => s.id === cap.sourceId) : undefined;
    const chain: string[] = [];
    const ids: string[] = [b.id];
    if (src) { chain.push(`Source: ${snippet(src.title, 30)}`); ids.push(src.id); }
    if (cap) { chain.push(`Capture: ${snippet(cap.text, 30)}`); }
    chain.push(`Belief: ${snippet(b.text, 30)}`);
    if (b.revisions.length > 1) chain.push(`Revised ${b.revisions.length - 1}×`);
    if (chain.length > 1) out.push({ chain, evidenceIds: [...new Set(ids)] });
  }
  // Comparison/inquiry → belief influence.
  for (const c of state.comparisons) {
    if (!resolved.comparisonIds.has(c.id)) continue;
    for (const bid of c.beliefIds) {
      if (targetBeliefId && bid !== targetBeliefId) continue;
      const b = state.beliefs.find((x) => x.id === bid);
      if (b) out.push({ chain: [`Comparison: ${snippet(c.title, 30)}`, `Belief: ${snippet(b.text, 30)}`], evidenceIds: [c.id, b.id] });
    }
  }
  return out.slice(0, 15);
}

// ---------------- Assumption audit ----------------

export function assumptionAudit(state: StoreState, resolved: ResolvedScope): ReasoningFinding[] {
  const byNorm = new Map<string, { text: string; ids: Set<string> }>();
  const add = (text: string, id: string) => {
    const key = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 120);
    if (!key) return;
    const e = byNorm.get(key) ?? { text, ids: new Set<string>() };
    e.ids.add(id);
    byNorm.set(key, e);
  };
  for (const c of state.comparisons) {
    if (!resolved.comparisonIds.has(c.id)) continue;
    for (const a of c.result.assumptions) add(a.statement, c.id);
  }
  for (const i of state.inquiries) {
    if (!resolved.inquiryIds.has(i.id)) continue;
    for (const a of i.result.assumptions) add(a.statement, i.id);
  }
  const out: ReasoningFinding[] = [];
  for (const { text, ids } of byNorm.values()) {
    out.push({ statement: ids.size > 1 ? `Recurring assumption (${ids.size}×): ${text}` : `Assumption: ${text}`, evidenceIds: [...ids] });
  }
  // Recurring first.
  return out.sort((a, b) => b.evidenceIds.length - a.evidenceIds.length).slice(0, 15);
}

// ---------------- Belief impact analysis ----------------

export function beliefImpact(state: StoreState, resolved: ResolvedScope, proposed: string): { affected: ReasoningFinding[]; unresolved: string[] } {
  const pt = tokens(proposed);
  const pn = NEGATION.test(proposed);
  const affected: ReasoningFinding[] = [];
  for (const b of state.beliefs) {
    if (!resolved.beliefIds.has(b.id) || b.status === "rejected") continue;
    const o = overlap(pt, tokens(b.text));
    if (o < 2) continue;
    const opp = NEGATION.test(b.text) !== pn;
    affected.push({
      statement: `${opp ? "May challenge" : "May support"} your belief “${snippet(b.text, 60)}”.`,
      evidenceIds: [b.id],
    });
  }
  const unresolved: string[] = [];
  for (const i of state.inquiries) {
    if (overlap(pt, tokens(i.question)) >= 2) unresolved.push(`This may reopen your inquiry: “${snippet(i.question, 60)}”.`);
  }
  for (const t of state.megathreads) {
    if (overlap(pt, tokens(`${t.title} ${t.description ?? ""}`)) >= 2) affected.push({ statement: `May affect your Megathread “${snippet(t.title, 50)}”.`, evidenceIds: [t.id] });
  }
  return { affected: affected.slice(0, 20), unresolved: unresolved.slice(0, 8) };
}

// ---------------- Change over time ----------------

export function changeOverTime(state: StoreState, resolved: ResolvedScope): { findings: ReasoningFinding[]; unresolved: string[] } {
  const findings = state.beliefs
    .filter((b) => resolved.beliefIds.has(b.id))
    .map((b) => ({ b, changes: Math.max(0, b.revisions.length - 1) + b.judgments.filter((j) => j.decision === "questioned" || j.decision === "rewritten").length }))
    .filter((x) => x.changes > 0)
    .sort((a, b) => b.changes - a.changes)
    .slice(0, 8)
    .map(({ b, changes }) => ({ statement: `You changed your mind most on “${snippet(b.text, 60)}” (${changes} change${changes === 1 ? "" : "s"}).`, evidenceIds: [b.id] }));
  return { findings, unresolved: [] };
}

// ---------------- Unresolved-question synthesis ----------------

export function unresolvedSynthesis(state: StoreState, resolved: ResolvedScope): { findings: ReasoningFinding[]; unresolved: string[] } {
  const findings: ReasoningFinding[] = [];
  const unresolved: string[] = [];
  for (const i of state.inquiries) {
    if (resolved.inquiryIds.has(i.id) && i.status === "unresolved") {
      findings.push({ statement: `Open inquiry: “${snippet(i.question, 70)}”.`, evidenceIds: [i.id] });
      unresolved.push(i.question);
    }
  }
  for (const t of state.megathreads) {
    if (!resolved.threadIds.has(t.id)) continue;
    for (const q of t.unresolvedQuestions.filter((x) => !x.resolved)) {
      findings.push({ statement: `Open in thread “${snippet(t.title, 40)}”: ${q.text}`, evidenceIds: [t.id] });
      unresolved.push(q.text);
    }
  }
  return { findings: findings.slice(0, 20), unresolved: [...new Set(unresolved)].slice(0, 12) };
}
