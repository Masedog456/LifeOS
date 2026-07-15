/**
 * Alignment review (LIFEOS-013, Phase 7).
 *
 * "What did I say I believe, and what did I report living?" — grounded ONLY in
 * accepted beliefs, the user's own reflections, and accepted practices. It
 * never infers private behavior from missing data, never accuses or diagnoses,
 * and uses cautious wording. Observations must cite real record ids.
 */

import type { AlignmentData, EvidenceItem, StoreState } from "@/types/mvp";
import { alignmentReflection } from "@/lib/aiClient";
import { validateAlignment } from "@/lib/formation/schema";

/** Packet: accepted beliefs + user reflections + accepted practices only. */
export function alignmentEvidence(state: StoreState): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  for (const b of state.beliefs.filter((b) => b.status === "accepted")) {
    out.push({ id: b.id, kind: "belief", group: "Belief you hold", text: b.text });
  }
  for (const r of state.reflections) {
    out.push({ id: r.id, kind: "belief", group: "Your reflection", text: `${r.prompt} — you wrote: ${r.response.slice(0, 200)}` });
  }
  for (const p of state.practices.filter((p) => p.status === "accepted")) {
    out.push({ id: p.id, kind: "claim", group: "Practice you accepted", text: p.userWording || p.title });
  }
  return out.slice(0, 40);
}

export function estimateAlignment(state: StoreState): { calls: number; evidenceCount: number } {
  return { calls: 1, evidenceCount: alignmentEvidence(state).length };
}

export async function runAlignmentReflection(
  state: StoreState,
): Promise<{ alignment: AlignmentData; source: "ai" | "mock" }> {
  const evidence = alignmentEvidence(state);
  const validIds = new Set(evidence.map((e) => e.id));
  const { result: raw, source } = await alignmentReflection({ evidence });
  const alignment = validateAlignment(raw, validIds);
  return { alignment, source };
}
