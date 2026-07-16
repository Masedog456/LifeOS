/**
 * Decision analysis orchestrator (LIFEOS-016, Phase 8).
 *
 * Sequence: deterministic evidence retrieval → deterministic tradeoff
 * calculations → ONE structured `decision_synthesis` AI call → citation
 * validation → OPTIONAL verification for large decisions. Mock fallback keeps
 * everything working offline. Nothing here chooses for the user, and nothing
 * runs automatically in the background.
 */

import type { Coverage, Decision, DecisionAnalysisResult, EvidenceItem, StoreState } from "@/types/mvp";
import { decisionSynthesis, verifyDecision } from "@/lib/aiClient";
import { buildDecisionEvidence } from "@/lib/decision/evidence";
import { validateDecisionAnalysis } from "@/lib/decision/schema";
import { tradeoffContext } from "@/lib/decision/tradeoffs";
import { decisionDeps, makeFingerprint } from "@/lib/freshness/fingerprint";
import type { MockDecisionContext } from "@/lib/mockDecision";

export const MAX_OPTIONS = 8;
export const MIN_OPTIONS = 2;
export const MAX_CRITERIA = 12;
/** Larger decisions (many options or a big packet) get a verification pass. */
const VERIFY_OPTION_THRESHOLD = 5;

function coverageOf(state: StoreState, evidence: EvidenceItem[]): { coverage: Coverage | null; partial: boolean; note: string } {
  const sourceIds = new Set(evidence.map((e) => e.id));
  const inScope = state.sources.filter((s) => sourceIds.has(s.id));
  const partial = inScope.some((s) => s.analysis?.coverage === "sampled" || s.extractionStatus === "partial_text");
  const coverage: Coverage | null = partial ? "sampled" : inScope.length > 0 ? "full" : null;
  const note = partial
    ? "Partial coverage: some sources in this decision's evidence were only partly analyzed."
    : "Based only on what you have recorded in LifeOS — it cannot see your life, only your records.";
  return { coverage, partial, note };
}

function toContext(d: Decision): MockDecisionContext {
  return {
    question: d.question,
    options: d.options.map((o) => ({
      name: o.name,
      reversibility: o.reversibility,
      benefits: o.benefits,
      costs: o.costs,
      risks: o.risks,
    })),
    criteria: d.criteria.map((c) => c.name),
    constraints: d.constraints,
    assumptions: d.assumptions,
    tradeoffContext: tradeoffContext(d),
  };
}

export function estimateDecisionAnalysis(state: StoreState, d: Decision) {
  const evidence = buildDecisionEvidence(state, d);
  const { partial, note } = coverageOf(state, evidence);
  const verify = d.options.length >= VERIFY_OPTION_THRESHOLD;
  return {
    calls: verify ? 2 : 1,
    evidenceCount: evidence.length,
    partial,
    coverageNote: note,
    tooManyOptions: d.options.length > MAX_OPTIONS,
    tooFewOptions: d.options.length < MIN_OPTIONS,
  };
}

/**
 * Run one analysis. Returns the pieces the caller persists via the store —
 * the prior analysis is preserved in history there, and the user's rationale,
 * choices, and judgments are never touched.
 */
export async function runDecisionAnalysis(
  state: StoreState,
  d: Decision,
): Promise<{
  analysis: DecisionAnalysisResult;
  evidence: EvidenceItem[];
  source: "ai" | "mock";
  coverage: Coverage | null;
  partial: boolean;
  verified: boolean;
  fingerprint: Decision["fingerprint"];
}> {
  if (d.options.length < MIN_OPTIONS) throw new Error(`Add at least ${MIN_OPTIONS} options first.`);
  if (d.options.length > MAX_OPTIONS) throw new Error(`At most ${MAX_OPTIONS} options are supported.`);

  const evidence = buildDecisionEvidence(state, d);
  const { coverage, partial, note } = coverageOf(state, evidence);
  const validIds = new Set(evidence.map((e) => e.id));
  const context = toContext(d);

  const { result: raw, source } = await decisionSynthesis({ evidence, context });
  let analysis = validateDecisionAnalysis(raw, validIds, {
    question: d.question,
    options: d.options.map((o) => o.name),
    criteria: d.criteria.map((c) => c.name),
    coverageNote: note,
  });

  let verified = false;
  if (d.options.length >= VERIFY_OPTION_THRESHOLD) {
    verified = true;
    try {
      const { result: review } = await verifyDecision(evidence, analysis);
      const remove = new Set((review.removeStatements ?? []).map((s) => s.trim()));
      const cautions = (review.cautions ?? []).map((s) => s.trim()).filter(Boolean);
      if (remove.size) {
        const keep = <T extends { statement: string }>(arr: T[]) => arr.filter((p) => !remove.has(p.statement.trim()));
        analysis = {
          ...analysis,
          tradeoffs: keep(analysis.tradeoffs),
          assumptions: keep(analysis.assumptions),
          risks: keep(analysis.risks),
          valuesAlignment: keep(analysis.valuesAlignment),
        };
      }
      if (cautions.length) analysis = { ...analysis, flagged: [...(analysis.flagged ?? []), ...cautions] };
    } catch {
      // Verification is best-effort; never blocks the result.
    }
  }

  const fingerprint = makeFingerprint(state, decisionDeps({ ...d, evidence }));
  return { analysis, evidence, source, coverage, partial, verified, fingerprint };
}
