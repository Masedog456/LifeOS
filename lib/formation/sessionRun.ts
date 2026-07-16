/**
 * Formation-synthesis orchestrator (LIFEOS-017, Phase 5).
 *
 * Sequence: deterministic evidence retrieval → ONE structured
 * `formation_synthesis` AI call → citation validation → freshness fingerprint.
 * Mock fallback keeps everything working offline. Nothing here concludes for
 * the user, and nothing runs automatically in the background.
 */

import type { Coverage, EvidenceItem, FormationSession, FormationSynthesisData, StoreState } from "@/types/mvp";
import { formationSynthesis } from "@/lib/aiClient";
import { buildFormationEvidence } from "@/lib/formation/sessionEvidence";
import { validateFormationSynthesis } from "@/lib/formation/sessionSchema";
import { formationDeps, makeFingerprint } from "@/lib/freshness/fingerprint";
import type { MockFormationContext } from "@/lib/mockFormationSession";

function coverageOf(state: StoreState, evidence: EvidenceItem[]): { coverage: Coverage | null; partial: boolean; note: string } {
  const ids = new Set(evidence.map((e) => e.id));
  const inScope = state.sources.filter((s) => ids.has(s.id));
  const partial = inScope.some((s) => s.analysis?.coverage === "sampled" || s.extractionStatus === "partial_text");
  const coverage: Coverage | null = partial ? "sampled" : inScope.length > 0 ? "full" : null;
  const note = partial
    ? "Partial coverage: some sources in this reflection's evidence were only partly analyzed."
    : "Based only on what you have recorded in LifeOS — it cannot see your life, only your records.";
  return { coverage, partial, note };
}

function toContext(s: FormationSession): MockFormationContext {
  return {
    reflection: s.reflection,
    lessons: s.lessons,
    unresolvedQuestions: s.unresolvedQuestions,
    emotionalObservations: s.emotionalObservations,
    revisedAssumptions: s.revisedAssumptions,
    beliefCandidates: s.beliefCandidates,
  };
}

export function estimateFormationSynthesis(state: StoreState, s: FormationSession) {
  const evidence = buildFormationEvidence(state, s);
  const { partial, note } = coverageOf(state, evidence);
  return { calls: 1, evidenceCount: evidence.length, partial, coverageNote: note };
}

/**
 * Run one synthesis. Returns the pieces the caller persists via the store —
 * the prior synthesis is preserved in history there, and the user's reflection,
 * structured capture, and judgments are never touched.
 */
export async function runFormationSynthesis(
  state: StoreState,
  s: FormationSession,
): Promise<{
  synthesis: FormationSynthesisData;
  evidence: EvidenceItem[];
  source: "ai" | "mock";
  coverage: Coverage | null;
  partial: boolean;
  fingerprint: FormationSession["fingerprint"];
}> {
  if (!s.reflection.trim()) throw new Error("Write your reflection first.");

  const evidence = buildFormationEvidence(state, s);
  const { coverage, partial, note } = coverageOf(state, evidence);
  const validIds = new Set(evidence.map((e) => e.id));
  const context = toContext(s);

  const { result: raw, source } = await formationSynthesis({ evidence, context, reflection: s.reflection });
  const synthesis = validateFormationSynthesis(raw, validIds, { coverageNote: note });

  const fingerprint = makeFingerprint(state, formationDeps({ ...s, evidence }));
  return { synthesis, evidence, source, coverage, partial, fingerprint };
}
