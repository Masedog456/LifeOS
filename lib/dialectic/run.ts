/**
 * Dialectic orchestrator (LIFEOS-011, Phase 6).
 *
 * Flow: deterministic evidence packet → ONE structured `dialectic` AI call →
 * strict validation (drop ungrounded assertions) → OPTIONAL second
 * verification pass (larger inquiries only). Mock fallback keeps every step
 * functional offline. Nothing here writes to the store or the Constitution.
 */

import type {
  DialecticResultData,
  EvidenceItem,
  Inquiry,
  InquiryInputRef,
  InquiryRevision,
  StoreState,
} from "@/types/mvp";
import { runDialectic, verifyDialectic } from "@/lib/aiClient";
import { buildInquiryEvidence, inquiryCoverage } from "@/lib/dialectic/evidence";
import { validateDialectic } from "@/lib/dialectic/schema";

export const MAX_SOURCES = 5;
/** An inquiry with this many source inputs runs the extra verification pass. */
export const VERIFY_THRESHOLD = 4;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `inq_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** Pre-flight estimate for the workspace. */
export function estimateInquiry(
  state: StoreState,
  inputs: InquiryInputRef[],
  question: string,
): {
  evidence: EvidenceItem[];
  calls: number;
  partial: boolean;
  coverageNote: string;
  sourceCount: number;
  tooMany: boolean;
} {
  const { groups, flat } = buildInquiryEvidence(state, inputs, question);
  const { partial, note } = inquiryCoverage(groups);
  const sourceCount = inputs.filter((i) => i.kind === "source").length;
  return {
    evidence: flat,
    calls: sourceCount >= VERIFY_THRESHOLD ? 2 : 1,
    partial,
    coverageNote: note,
    sourceCount,
    tooMany: sourceCount > MAX_SOURCES,
  };
}

/** Core: build packet, call AI, validate, optionally verify. Returns a result. */
async function produceResult(
  state: StoreState,
  inputs: InquiryInputRef[],
  question: string,
): Promise<{
  result: DialecticResultData;
  evidence: EvidenceItem[];
  source: "ai" | "mock";
  coverage: ReturnType<typeof inquiryCoverage>["coverage"];
  partial: boolean;
  verified: boolean;
}> {
  const { groups, flat } = buildInquiryEvidence(state, inputs, question);
  const { coverage, partial, note } = inquiryCoverage(groups);
  const validIds = new Set(flat.map((e) => e.id));
  const q = question.trim() || "What does the evidence support on this question?";

  const { result: raw, source } = await runDialectic({ evidence: flat, question: q, coverageNote: note });
  let result = validateDialectic(raw, validIds, { question: q, coverageNote: note });

  let verified = false;
  const sourceCount = inputs.filter((i) => i.kind === "source").length;
  if (sourceCount >= VERIFY_THRESHOLD) {
    verified = true;
    try {
      const { result: review } = await verifyDialectic(flat, result);
      const remove = new Set((review.removeStatements ?? []).map((s) => s.trim()));
      const cautions = (review.cautions ?? []).map((s) => s.trim()).filter(Boolean);
      if (remove.size) {
        const keep = <T extends { statement: string }>(arr: T[]) => arr.filter((p) => !remove.has(p.statement.trim()));
        result = {
          ...result,
          assumptions: keep(result.assumptions),
          affirmativeCase: keep(result.affirmativeCase),
          negativeCase: keep(result.negativeCase),
          counterarguments: keep(result.counterarguments),
          rebuttals: keep(result.rebuttals),
          relationToBeliefs: keep(result.relationToBeliefs),
        };
      }
      if (cautions.length) result = { ...result, flagged: [...(result.flagged ?? []), ...cautions] };
    } catch {
      // Verification is best-effort; a failure never blocks the result.
    }
  }

  return { result, evidence: flat, source, coverage, partial, verified };
}

/** Run a fresh inquiry. Returns an unsaved Inquiry (caller persists). */
export async function runInquiryFlow(
  state: StoreState,
  inputs: InquiryInputRef[],
  question: string,
): Promise<Inquiry> {
  if (!question.trim()) throw new Error("Enter a question to investigate.");
  if (inputs.filter((i) => i.kind === "source").length < 1)
    throw new Error("Select at least one source to investigate.");

  const { result, evidence, source, coverage, partial, verified } = await produceResult(state, inputs, question);
  const now = new Date().toISOString();
  const model = source === "ai" ? (process.env.NEXT_PUBLIC_ANTHROPIC_MODEL ?? "anthropic") : "mock";

  return {
    id: newId(),
    question: question.trim(),
    inputs,
    sourceIds: [...new Set(inputs.map((i) => i.sourceId).filter((x): x is string => Boolean(x)))],
    beliefIds: [...new Set(inputs.map((i) => i.beliefId).filter((x): x is string => Boolean(x)))],
    comparisonIds: [...new Set(inputs.map((i) => i.comparisonId).filter((x): x is string => Boolean(x)))],
    evidence,
    result,
    history: [],
    aiModel: model,
    source,
    coverage,
    partial,
    verified,
    status: "open",
    judgments: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Evolve a saved inquiry with additional materials, re-running the dialectic.
 * The PRIOR result is pushed into append-only history; nothing is overwritten.
 */
export async function evolveInquiryFlow(
  state: StoreState,
  inquiry: Inquiry,
  addedInputs: InquiryInputRef[],
  question?: string,
): Promise<Inquiry> {
  const q = (question ?? inquiry.question).trim();
  const mergedInputs = [...inquiry.inputs];
  for (const add of addedInputs) {
    const dup = mergedInputs.some(
      (i) => i.kind === add.kind && i.sourceId === add.sourceId && i.beliefId === add.beliefId && i.comparisonId === add.comparisonId,
    );
    if (!dup) mergedInputs.push(add);
  }

  const { result, evidence, source, coverage, partial, verified } = await produceResult(state, mergedInputs, q);
  const now = new Date().toISOString();
  const model = source === "ai" ? (process.env.NEXT_PUBLIC_ANTHROPIC_MODEL ?? "anthropic") : "mock";

  const historyEntry: InquiryRevision = {
    at: inquiry.updatedAt,
    result: inquiry.result,
    source: inquiry.source,
    addedInputs: addedInputs.map((i) => i.label),
  };

  return {
    ...inquiry,
    question: q,
    inputs: mergedInputs,
    sourceIds: [...new Set(mergedInputs.map((i) => i.sourceId).filter((x): x is string => Boolean(x)))],
    beliefIds: [...new Set(mergedInputs.map((i) => i.beliefId).filter((x): x is string => Boolean(x)))],
    comparisonIds: [...new Set(mergedInputs.map((i) => i.comparisonId).filter((x): x is string => Boolean(x)))],
    evidence,
    result,
    history: [...inquiry.history, historyEntry],
    aiModel: model,
    source,
    coverage,
    partial,
    verified,
    updatedAt: now,
  };
}
