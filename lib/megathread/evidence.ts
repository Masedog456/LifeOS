/**
 * Deterministic evidence packet for thread synthesis (LIFEOS-012, Phase 6).
 *
 * Reuses the inquiry evidence builder over the thread's source/belief/
 * comparison members, then appends inquiry findings — continuing the same
 * `E1…En` id sequence. Capped; whole sources are never sent. Excluded members
 * are skipped.
 */

import type {
  Coverage,
  EvidenceGroup,
  EvidenceItem,
  InquiryInputRef,
  Megathread,
  StoreState,
} from "@/types/mvp";
import { buildInquiryEvidence, inquiryCoverage } from "@/lib/dialectic/evidence";

function snippet(s: string, n = 40): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

export function buildThreadEvidence(
  state: StoreState,
  thread: Megathread,
): { groups: EvidenceGroup[]; flat: EvidenceItem[]; coverage: Coverage | null; partial: boolean; coverageNote: string } {
  const excluded = new Set(thread.excluded);
  const refs: InquiryInputRef[] = [];

  for (const m of thread.members) {
    if (excluded.has(m.id)) continue;
    if (m.type === "source") {
      const s = state.sources.find((x) => x.id === m.id);
      if (s) refs.push({ kind: "source", sourceId: s.id, label: s.title });
    } else if (m.type === "belief") {
      const b = state.beliefs.find((x) => x.id === m.id);
      if (b) refs.push({ kind: "belief", beliefId: b.id, label: `Belief: ${snippet(b.text)}` });
    } else if (m.type === "comparison") {
      const c = state.comparisons.find((x) => x.id === m.id);
      if (c) refs.push({ kind: "comparison", comparisonId: c.id, label: `Comparison: ${snippet(c.title)}` });
    }
  }

  const { groups, flat } = buildInquiryEvidence(state, refs, `${thread.title} ${thread.description ?? ""}`);

  // Append inquiry findings (affirmative/negative cases) as evidence.
  let n = flat.length;
  const seq = () => `E${++n}`;
  const extra: EvidenceItem[] = [];
  for (const m of thread.members) {
    if (m.type !== "inquiry" || excluded.has(m.id)) continue;
    const inq = state.inquiries.find((x) => x.id === m.id);
    if (!inq) continue;
    const g = `Inquiry: ${snippet(inq.question)}`;
    for (const p of inq.result.affirmativeCase.slice(0, 2)) {
      extra.push({ id: seq(), kind: "comparison_finding", group: g, text: `Affirmative: ${p.statement}` });
    }
    for (const p of inq.result.negativeCase.slice(0, 2)) {
      extra.push({ id: seq(), kind: "comparison_finding", group: g, text: `Negative: ${p.statement}` });
    }
  }

  const { coverage, partial, note } = inquiryCoverage(groups);
  return { groups, flat: [...flat, ...extra], coverage, partial, coverageNote: note };
}
