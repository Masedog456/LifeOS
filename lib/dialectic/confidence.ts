/**
 * Separated confidence model (LIFEOS-023).
 *
 * Confidence is tracked along four independent axes — factual, logical,
 * evidential, experiential — and NEVER collapsed into a single number. False
 * certainty most often comes from averaging away a weak dimension, so every
 * surface shows the four separately. `unknown` is a first-class value: it is
 * honest to say we don't know, and the engine defaults to the more conservative
 * reading whenever the signal is thin.
 */

import type { ConfidenceLevel, DialecticConfidence } from "@/types/mvp";

export const CONFIDENCE_ORDER: ConfidenceLevel[] = ["unknown", "low", "moderate", "high"];

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  unknown: "Unknown",
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

/** All-unknown: the honest default before any evidence is weighed. */
export function unknownConfidence(): DialecticConfidence {
  return { factual: "unknown", logical: "unknown", evidential: "unknown", experiential: "unknown" };
}

function rank(l: ConfidenceLevel): number {
  return CONFIDENCE_ORDER.indexOf(l);
}

/** The weakest of a set — used to describe a whole (without collapsing the axes). */
export function weakest(levels: ConfidenceLevel[]): ConfidenceLevel {
  if (levels.length === 0) return "unknown";
  return levels.reduce((a, b) => (rank(b) < rank(a) ? b : a));
}

/** Map a small non-negative count to a conservative level (0→unknown, 1→low, 2→moderate, 3+→high). */
export function levelFromCount(n: number): ConfidenceLevel {
  if (n <= 0) return "unknown";
  if (n === 1) return "low";
  if (n === 2) return "moderate";
  return "high";
}

/**
 * Derive a deliberately conservative confidence for a tension/synthesis from the
 * evidence available. Each axis is set independently:
 *  - factual:      how many distinct source records are cited
 *  - logical:      caller-supplied (validity of the reasoning link) — stays as given
 *  - evidential:   how many evidence links point at each side (min of the two)
 *  - experiential: how many first-person records (reflections/formation) are cited
 * Nothing here averages the axes together.
 */
export function deriveConfidence(input: {
  sourceCount: number;
  thesisEvidence: number;
  antithesisEvidence: number;
  experientialCount: number;
  logical?: ConfidenceLevel;
}): DialecticConfidence {
  return {
    factual: levelFromCount(input.sourceCount),
    logical: input.logical ?? "unknown",
    // Evidential strength is only as strong as the WEAKER-supported side — a
    // tension with lopsided evidence is not evidentially strong, it's unbalanced.
    evidential: levelFromCount(Math.min(input.thesisEvidence, input.antithesisEvidence)),
    experiential: levelFromCount(input.experientialCount),
  };
}
