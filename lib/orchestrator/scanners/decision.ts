/**
 * Decision scanner (LIFEOS-024).
 *
 * Inspects Decision Intelligence only. A decision that was made but never
 * reviewed for its outcome is a learning opportunity left on the table. Emits
 * `revisit_decision`. Deterministic against the store's own timestamps.
 */

import type { StoreState } from "@/types/mvp";
import { proposal, type RecommendationProposal, type Scanner } from "@/lib/orchestrator/types";

const REVIEW_AFTER_DAYS = 30;

export const decisionScanner: Scanner = (state: StoreState): RecommendationProposal[] => {
  const out: RecommendationProposal[] = [];
  const now = Date.now();
  const cutoff = REVIEW_AFTER_DAYS * 24 * 60 * 60 * 1000;

  for (const d of state.decisions) {
    if (d.status !== "decided") continue;
    if (d.outcomeReviews.length > 0) continue;
    const decidedAt = Date.parse(d.updatedAt);
    if (Number.isNaN(decidedAt) || now - decidedAt < cutoff) continue;
    out.push(proposal({
      type: "revisit_decision",
      priority: "low",
      confidence: "moderate",
      subsystem: "decision",
      rationale: `You decided “${d.title}” over a month ago and haven't reviewed how it turned out. An outcome review is how the decision engine learns.`,
      suggestedAction: "Record an outcome review for this decision.",
      actionHref: `/decisions/${d.id}`,
      affected: [{ kind: "decision", id: d.id, label: d.title }],
    }));
  }
  return out;
};
