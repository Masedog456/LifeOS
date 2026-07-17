/**
 * Research timeline (LIFEOS-020, Phase 7).
 *
 * A DERIVED, read-only, chronological view of an investigation — discoveries,
 * hypothesis revisions, question revisions, evidence additions, and decision
 * points — aggregated from the append-only history kept on the project and its
 * sub-artifacts. Built fresh each render; never stored, deduped by stable id.
 */

import type { ResearchProject, ResearchTimelineItem } from "@/types/mvp";

function snippet(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

export function buildResearchTimeline(p: ResearchProject, limit = 200): ResearchTimelineItem[] {
  const items: ResearchTimelineItem[] = [];

  for (let i = 0; i < p.history.length; i++) {
    const h = p.history[i];
    items.push({ id: `proj:${p.id}:${i}`, at: h.at, kind: "project", title: h.note });
  }

  for (const h of p.hypotheses) {
    items.push({ id: `hyp:${h.id}:0`, at: h.createdAt, kind: "hypothesis", title: `Hypothesis: ${snippet(h.statement)}` });
    for (let i = 0; i < h.history.length; i++) {
      const e = h.history[i];
      items.push({ id: `hyp:${h.id}:${i + 1}`, at: e.at, kind: "hypothesis", title: `Hypothesis ${snippet(h.statement, 40)}`, detail: e.note });
    }
  }

  const questionItems = [
    ...p.questions.subquestions, ...p.questions.unknowns, ...p.questions.assumptions,
    ...p.questions.successCriteria, ...p.questions.openProblems,
  ];
  for (const q of questionItems) {
    items.push({ id: `q:${q.id}:0`, at: q.createdAt, kind: "question", title: `Question: ${snippet(q.text)}` });
    for (let i = 0; i < q.history.length; i++) {
      const e = q.history[i];
      items.push({ id: `q:${q.id}:${i + 1}`, at: e.at, kind: "question", title: snippet(q.text, 40), detail: e.note });
    }
  }

  for (const n of p.argumentNodes) {
    items.push({ id: `arg:${n.id}`, at: n.createdAt, kind: "argument", title: `${n.kind.replace(/_/g, " ")}: ${snippet(n.text)}` });
  }

  const seen = new Set<string>();
  return items
    .filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, limit);
}
