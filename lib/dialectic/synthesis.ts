/**
 * Deterministic synthesis generation (LIFEOS-023).
 *
 * Given a tension, the engine proposes candidate SYNTHESES as structured
 * scaffolds — never finished answers. A candidate always: preserves the
 * strongest insight from each side, names the assumption it discards, exposes
 * any hidden common ground (records/concepts cited by BOTH sides), and states
 * what remains uncertain. A synthesis is never a mere compromise; the first
 * candidate attempts a higher-order integration, and a deferral candidate is
 * always offered so the user can preserve the tension when integration is not
 * yet justified. The user authors, edits, accepts, or rejects — the engine
 * decides nothing.
 */

import type {
  DialecticEvidenceLink,
  Synthesis,
  Tension,
} from "@/types/mvp";
import { unknownConfidence, weakest } from "@/lib/dialectic/confidence";

/** A generated candidate — not yet persisted (no id/timestamps/status transitions). */
export type SynthesisCandidate = Pick<
  Synthesis,
  | "statement"
  | "preservedInsights"
  | "discardedAssumptions"
  | "commonGround"
  | "remainingUncertainty"
  | "confidence"
  | "evidenceLinks"
> & { kind: "integration" | "scoped" | "deferral"; rationale: string };

function trimTo(s: string, n = 140): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n - 1).trimEnd() + "…" : one;
}

/** Records/labels cited by BOTH sides — the hidden common ground. */
function commonGround(t: Tension): string[] {
  const thesis = new Set(t.thesisRefs);
  const shared = t.antithesisRefs.filter((r) => thesis.has(r));
  const labels = shared.map((r) => t.evidence.find((e) => e.refId === r)?.label ?? r);
  return labels.length
    ? labels
    : ["Both positions are being held by the same person, in good faith, about the same question."];
}

export function generateSyntheses(tension: Tension): SynthesisCandidate[] {
  const thesis = trimTo(tension.thesis);
  const antithesis = trimTo(tension.antithesis);
  const ground = commonGround(tension);
  // Evidence carries over as context so the user can inspect it on the synthesis.
  const evidenceLinks: DialecticEvidenceLink[] = tension.evidence.map((e) => ({ ...e, stance: "context" }));

  const preserved = [
    `From the thesis: ${thesis}`,
    `From the antithesis: ${antithesis}`,
  ];
  const uncertainty = tension.unresolvedQuestions.slice();

  // 1. Higher-order integration — the two are true of different aspects, not exclusive.
  const integration: SynthesisCandidate = {
    kind: "integration",
    rationale: "Attempts a higher-order framing in which each side captures a real part of the picture.",
    statement: `Each position preserves something true: “${thesis}” and “${antithesis}” need not exclude one another once we distinguish the respects in which each holds.`,
    preservedInsights: preserved,
    discardedAssumptions: ["The assumption that the two positions are mutually exclusive."],
    commonGround: ground,
    remainingUncertainty: uncertainty,
    confidence: { ...unknownConfidence(), logical: "low" },
    evidenceLinks,
  };

  // 2. Scoped resolution — each holds under stated conditions.
  const scoped: SynthesisCandidate = {
    kind: "scoped",
    rationale: "Resolves the tension by scoping each side to the conditions under which it holds.",
    statement: `“${thesis}” holds under one set of conditions; “${antithesis}” holds under another. Naming those conditions dissolves the apparent conflict without discarding either.`,
    preservedInsights: preserved,
    discardedAssumptions: ["The assumption that one framing must apply universally."],
    commonGround: ground,
    remainingUncertainty: ["Which conditions select each side — this must be stated explicitly.", ...uncertainty],
    // Scoping is a logical move; its factual/evidential strength still rests on the evidence.
    confidence: { ...tension.confidence, logical: weakest([tension.confidence.logical, "moderate"]) },
    evidenceLinks,
  };

  // 3. Deferral — preserve the tension when integration is not yet justified.
  const deferral: SynthesisCandidate = {
    kind: "deferral",
    rationale: "Preserves the tension honestly when the evidence does not yet justify integrating.",
    statement: `Hold both positions as a live, unresolved tension. There is not yet enough to justify integrating “${thesis}” with “${antithesis}”; keeping them in view is more honest than a premature resolution.`,
    preservedInsights: preserved,
    discardedAssumptions: ["The assumption that every tension must be resolved now."],
    commonGround: ground,
    remainingUncertainty: uncertainty.length ? uncertainty : ["What evidence or argument would justify integrating these?"],
    confidence: unknownConfidence(),
    evidenceLinks,
  };

  return [integration, scoped, deferral];
}
