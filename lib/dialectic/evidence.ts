/**
 * Deterministic evidence packet for dialectical inquiry (LIFEOS-011, Phase 3).
 *
 * Reuses the LIFEOS-010 comparison evidence builder for source/belief/passage
 * inputs, then appends dialectic-specific evidence — belief REVISIONS (how the
 * user's thinking has already moved), prior COMPARISON findings, and
 * TERMINOLOGY disputes — continuing the same `E1…En` id sequence so every item
 * stays citable. Nothing is fabricated and no AI is called here.
 */

import type {
  ComparisonInputRef,
  Coverage,
  EvidenceGroup,
  EvidenceItem,
  InquiryInputRef,
  StoreState,
} from "@/types/mvp";
import { buildEvidence, coverageSummary } from "@/lib/comparison/evidence";

const MAX_COMPARISON_FINDINGS = 3;
const MAX_TERMINOLOGY = 2;

export function buildInquiryEvidence(
  state: StoreState,
  inputs: InquiryInputRef[],
  question: string,
): { groups: EvidenceGroup[]; flat: EvidenceItem[] } {
  // 1) Base packet from the comparison layer (sources, beliefs, passages).
  const baseRefs: ComparisonInputRef[] = inputs
    .filter((i) => i.kind === "source" || i.kind === "belief" || i.kind === "passage")
    .map((i) => ({
      kind: i.kind as ComparisonInputRef["kind"],
      label: i.label,
      sourceId: i.sourceId,
      beliefId: i.beliefId,
      quote: i.quote,
      page: i.page,
    }));
  const { groups, flat } = buildEvidence(state, baseRefs, question);

  // 2) Continue the id sequence for dialectic-specific evidence.
  let n = flat.length;
  const seq = () => `E${++n}`;
  const extraGroups: EvidenceGroup[] = [];

  for (const ref of inputs) {
    if (ref.kind === "belief" && ref.beliefId) {
      const belief = state.beliefs.find((b) => b.id === ref.beliefId);
      if (!belief) continue;
      const items: EvidenceItem[] = [];
      const seen = new Set<string>([belief.text]);
      // Earlier wordings — the thread already bent here.
      for (const rev of belief.revisions) {
        if (rev.text && !seen.has(rev.text)) {
          seen.add(rev.text);
          items.push({ id: seq(), kind: "revision", group: `${ref.label} (history)`, beliefId: belief.id, text: rev.text });
        }
      }
      if (items.length) extraGroups.push({ ref, coverage: null, partial: false, items });
    } else if (ref.kind === "comparison" && ref.comparisonId) {
      const c = state.comparisons.find((x) => x.id === ref.comparisonId);
      if (!c) continue;
      const items: EvidenceItem[] = [];
      for (const a of c.result.agreements.slice(0, MAX_COMPARISON_FINDINGS)) {
        items.push({ id: seq(), kind: "comparison_finding", group: ref.label, text: `Agreement: ${a.statement}` });
      }
      for (const d of c.result.disagreements.slice(0, MAX_COMPARISON_FINDINGS)) {
        items.push({ id: seq(), kind: "comparison_finding", group: ref.label, text: `Disagreement (${d.kind}): ${d.statement}` });
      }
      for (const t of c.result.terminologyDifferences.slice(0, MAX_TERMINOLOGY)) {
        items.push({ id: seq(), kind: "terminology", group: ref.label, text: `${t.term}: ${t.note}` });
      }
      if (items.length) extraGroups.push({ ref, coverage: c.coverage, partial: c.partial, items });
    }
  }

  const allGroups = [...groups, ...extraGroups];
  return { groups: allGroups, flat: allGroups.flatMap((g) => g.items) };
}

/** Coverage summary across the inquiry's materials. */
export function inquiryCoverage(groups: EvidenceGroup[]): {
  coverage: Coverage | null;
  partial: boolean;
  note: string;
} {
  return coverageSummary(groups);
}
