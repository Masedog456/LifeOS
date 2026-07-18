/**
 * Formation scanner (LIFEOS-024).
 *
 * Inspects Formation practices only. An accepted practice with a recurring
 * cadence is a standing invitation to reflect again. Emits `repeat_reflection`.
 * LifeOS never schedules or tracks streaks — this is a suggestion, not a nag.
 */

import type { StoreState } from "@/types/mvp";
import { proposal, type RecommendationProposal, type Scanner } from "@/lib/orchestrator/types";

export const formationScanner: Scanner = (state: StoreState): RecommendationProposal[] => {
  const out: RecommendationProposal[] = [];
  for (const p of state.practices) {
    if (p.status !== "accepted") continue;
    if (p.cadence !== "daily" && p.cadence !== "weekly") continue;
    const label = p.userWording?.trim() || p.title;
    out.push(proposal({
      type: "repeat_reflection",
      priority: p.cadence === "daily" ? "medium" : "low",
      confidence: "moderate",
      subsystem: "formation",
      rationale: `“${label}” is a ${p.cadence} practice you've accepted. Returning to it keeps the formation loop alive.`,
      suggestedAction: `Repeat this ${p.cadence} reflection.`,
      actionHref: `/formation`,
      affected: [{ kind: "practice", id: p.id, label }],
    }));
  }
  return out;
};
