/**
 * Comparison orchestrator (LIFEOS-010, Phase 5).
 *
 * Flow: deterministic evidence packet → ONE structured AI call → strict
 * validation (drop unsupported points) → OPTIONAL second verification pass
 * (only for larger comparisons). Mock fallback keeps every step functional
 * offline. Nothing here writes to the store or the Constitution.
 */

import type {
  Comparison,
  ComparisonInputRef,
  ComparisonResultData,
  EvidenceItem,
  StoreState,
} from "@/types/mvp";
import { runComparison, verifyComparison } from "@/lib/aiClient";
import { buildEvidence, coverageSummary } from "@/lib/comparison/evidence";
import { validateResult } from "@/lib/comparison/schema";

export const MAX_SOURCES = 5;
/** A comparison of this many source inputs runs the extra verification pass. */
export const VERIFY_THRESHOLD = 4;

function defaultTitle(inputs: ComparisonInputRef[]): string {
  const labels = inputs.map((i) => i.label);
  if (labels.length <= 2) return labels.join(" vs ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2} more`;
}

/** Pre-flight estimate for the workspace: call count, evidence size, warnings. */
export function estimateComparison(
  state: StoreState,
  inputs: ComparisonInputRef[],
  question: string,
): {
  evidence: EvidenceItem[];
  calls: number;
  partial: boolean;
  coverageNote: string;
  sourceCount: number;
  tooMany: boolean;
} {
  const { groups, flat } = buildEvidence(state, inputs, question);
  const { partial, note } = coverageSummary(groups);
  const sourceCount = inputs.filter((i) => i.kind === "source").length;
  const calls = sourceCount >= VERIFY_THRESHOLD ? 2 : 1;
  return {
    evidence: flat,
    calls,
    partial,
    coverageNote: note,
    sourceCount,
    tooMany: sourceCount > MAX_SOURCES,
  };
}

/**
 * Run the full comparison. Returns an unsaved Comparison (the caller decides
 * whether to persist). Throws only on truly empty input; AI failures degrade
 * to the deterministic mock.
 */
export async function runComparisonFlow(
  state: StoreState,
  inputs: ComparisonInputRef[],
  question: string,
): Promise<Comparison> {
  const sourceInputs = inputs.filter((i) => i.kind === "source");
  if (inputs.length < 2 && !(inputs.some((i) => i.kind === "belief") && sourceInputs.length >= 1)) {
    // Allow: ≥2 materials, OR one belief + ≥1 source.
    if (inputs.length < 2) throw new Error("Select at least two materials to compare.");
  }

  const { groups, flat } = buildEvidence(state, inputs, question);
  const { coverage, partial, note } = coverageSummary(groups);
  const title = defaultTitle(inputs);
  const sourcesCompared = inputs.map((i) => i.label);
  const validIds = new Set(flat.map((e) => e.id));

  const q = question.trim() || "Where do these materials agree, disagree, and use terms differently?";

  const { result: rawResult, source } = await runComparison({
    evidence: flat,
    question: q,
    title,
    sourcesCompared,
    coverageNote: note,
  });

  let result: ComparisonResultData = validateResult(rawResult, validIds, {
    title,
    question: q,
    sourcesCompared,
    coverageNote: note,
  });

  // Optional second verification pass for larger comparisons only.
  let verified = false;
  if (sourceInputs.length >= VERIFY_THRESHOLD) {
    verified = true;
    try {
      const { result: review } = await verifyComparison(flat, result);
      const remove = new Set((review.removeStatements ?? []).map((s) => s.trim()));
      const cautions = (review.cautions ?? []).map((s) => s.trim()).filter(Boolean);
      if (remove.size) {
        const keep = <T extends { statement: string }>(arr: T[]) => arr.filter((p) => !remove.has(p.statement.trim()));
        result = {
          ...result,
          agreements: keep(result.agreements),
          disagreements: keep(result.disagreements),
          assumptions: keep(result.assumptions),
          unresolvedTensions: keep(result.unresolvedTensions),
          relationToBeliefs: keep(result.relationToBeliefs),
        };
      }
      if (cautions.length) {
        result = { ...result, flagged: [...(result.flagged ?? []), ...cautions] };
      }
    } catch {
      // Verification is best-effort; a failure never blocks the result.
    }
  }

  const model = source === "ai" ? (process.env.NEXT_PUBLIC_ANTHROPIC_MODEL ?? "anthropic") : "mock";

  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `cmp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    title,
    question: q,
    inputs,
    sourceIds: [...new Set(inputs.map((i) => i.sourceId).filter((x): x is string => Boolean(x)))],
    beliefIds: [...new Set(inputs.map((i) => i.beliefId).filter((x): x is string => Boolean(x)))],
    evidence: flat,
    result,
    aiModel: model,
    source,
    coverage,
    partial,
    verified,
    createdAt: new Date().toISOString(),
    judgments: [],
  };
}
