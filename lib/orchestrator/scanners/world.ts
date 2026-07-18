/**
 * World Model scanner (LIFEOS-024).
 *
 * Inspects the World Model only. When a concept underpins several beliefs but is
 * not yet expressed as a principle, a reusable principle may be latent in it.
 * Emits `new_principle`.
 */

import type { StoreState } from "@/types/mvp";
import { proposal, type RecommendationProposal, type Scanner } from "@/lib/orchestrator/types";

const BELIEF_SUPPORT_THRESHOLD = 3;

export const worldScanner: Scanner = (state: StoreState): RecommendationProposal[] => {
  const out: RecommendationProposal[] = [];
  const liveBelief = new Set(state.beliefs.filter((b) => b.status !== "rejected").map((b) => b.id));

  for (const c of state.concepts) {
    if (c.status === "archived" || c.status === "merged") continue;
    if (c.principleIds.length > 0) continue;
    const supporting = c.relatedBeliefs.filter((id) => liveBelief.has(id));
    if (supporting.length >= BELIEF_SUPPORT_THRESHOLD) {
      out.push(proposal({
        type: "new_principle",
        priority: "medium",
        confidence: supporting.length >= BELIEF_SUPPORT_THRESHOLD + 2 ? "high" : "moderate",
        subsystem: "world",
        rationale: `The concept “${c.name}” underpins ${supporting.length} of your beliefs but isn't yet expressed as a principle. A reusable principle may be latent in it.`,
        suggestedAction: "Consider deriving a principle from this concept.",
        actionHref: `/world/concept/${c.id}`,
        affected: [
          { kind: "concept", id: c.id, label: c.name },
          ...supporting.slice(0, 3).map((id) => ({ kind: "belief", id, label: state.beliefs.find((b) => b.id === id)?.text ?? id })),
        ],
      }));
    }
  }
  return out;
};
