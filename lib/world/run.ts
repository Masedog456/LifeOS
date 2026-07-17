/**
 * World-model proposal orchestrator (LIFEOS-018, Phase 4).
 *
 * Sequence: deterministic candidates first → ONE `concept_extract` AI call over
 * the evidence packet → validation (bounds shapes, filters citations). Returns
 * a merged, deduped list of REVIEWABLE proposals. Mock fallback keeps it
 * working offline. Nothing here creates concepts — approval is a human action.
 */

import type { StoreState, WorldProposal } from "@/types/mvp";
import { proposeWorldModel } from "@/lib/aiClient";
import { buildWorldEvidence, deterministicProposals } from "@/lib/world/extract";
import { validateWorldProposals } from "@/lib/world/schema";

export function estimateWorldProposals(state: StoreState) {
  return { calls: 1, evidenceCount: buildWorldEvidence(state).length };
}

export async function runWorldProposals(
  state: StoreState,
): Promise<{ proposals: WorldProposal[]; flagged: string[]; source: "ai" | "mock" }> {
  const evidence = buildWorldEvidence(state);
  const validIds = new Set(evidence.map((e) => e.id));

  const { result: raw, source } = await proposeWorldModel({ evidence });
  const { proposals: aiProposals, flagged } = validateWorldProposals(raw, validIds);

  // Deterministic proposals first; then AI ones that don't duplicate them.
  const det = deterministicProposals(state);
  const seen = new Set(det.map((p) => `${p.kind}|${p.statement.toLowerCase()}`));
  const merged = [...det];
  for (const p of aiProposals) {
    const key = `${p.kind}|${p.statement.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(p);
  }
  return { proposals: merged.slice(0, 40), flagged, source };
}
