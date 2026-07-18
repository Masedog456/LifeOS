/**
 * Research scanner (LIFEOS-024).
 *
 * Inspects the Research Workspace only. When a research project both references
 * an accepted belief (in its evidence assembly) and holds a hypothesis with
 * contradicting evidence, the project is producing evidence that bears against a
 * belief — a synthesis is warranted. Emits `create_synthesis`.
 */

import type { StoreState } from "@/types/mvp";
import { proposal, type RecommendationProposal, type Scanner } from "@/lib/orchestrator/types";

export const researchScanner: Scanner = (state: StoreState): RecommendationProposal[] => {
  const out: RecommendationProposal[] = [];
  const accepted = new Map(state.beliefs.filter((b) => b.status === "accepted").map((b) => [b.id, b]));

  for (const rp of state.researchProjects) {
    const contested = rp.hypotheses.some((h) => h.contradictingEvidence.length > 0);
    if (!contested) continue;
    for (const bid of rp.assembly.beliefIds) {
      const belief = accepted.get(bid);
      if (!belief) continue;
      out.push(proposal({
        type: "create_synthesis",
        priority: "high",
        confidence: "moderate",
        subsystem: "research",
        rationale: `Research “${rp.title}” cites evidence that contradicts a hypothesis while referencing the accepted belief “${belief.text}”. The conflict deserves a synthesis, not a silent overwrite.`,
        suggestedAction: "Investigate the conflict in a dialogue and build a synthesis.",
        actionHref: `/dialogue?belief=${bid}&research=${rp.id}&topic=${encodeURIComponent(belief.text)}`,
        affected: [
          { kind: "research_project", id: rp.id, label: rp.title },
          { kind: "belief", id: bid, label: belief.text },
        ],
      }));
    }
  }
  return out;
};
