/**
 * Reasoning orchestrator (LIFEOS-014, Phase 6).
 *
 * Sequence: deterministic scope → deterministic graph → deterministic reasoning
 * pass → capped evidence packet → ONE AI synthesis call → citation validation →
 * OPTIONAL verification for large scopes. The grounded result comes from the
 * deterministic passes; the AI only adds a narrative layer. Mock keeps it
 * functional offline. Nothing here mutates any record or the Constitution.
 */

import type {
  Coverage,
  ReasoningMode,
  ReasoningQuery,
  ReasoningResultData,
  ReasoningScope,
  StoreState,
} from "@/types/mvp";
import { reasoningSynthesis, verifyReasoning } from "@/lib/aiClient";
import { buildReasoningGraph, MAX_SCOPE_SOURCES } from "@/lib/reasoning/graph";
import { validateReasoningAI } from "@/lib/reasoning/schema";
import { makeFingerprint } from "@/lib/freshness/fingerprint";
import {
  assumptionAudit,
  beliefImpact,
  changeOverTime,
  contradictionAudit,
  influenceTrace,
  supportAudit,
  unresolvedSynthesis,
} from "@/lib/reasoning/passes";

export const VERIFY_NODE_THRESHOLD = 30;

export const MODE_LABEL: Record<ReasoningMode, string> = {
  support_audit: "Support audit",
  contradiction_audit: "Contradiction audit",
  influence_trace: "Influence trace",
  assumption_audit: "Assumption audit",
  belief_impact: "Belief impact analysis",
  unresolved_synthesis: "Unresolved-question synthesis",
  change_over_time: "Change-over-time analysis",
  open_inquiry: "Open inquiry",
};

function coverageOf(state: StoreState, sourceIds: Set<string>): { coverage: Coverage | null; partial: boolean; note: string } {
  const inScope = state.sources.filter((s) => sourceIds.has(s.id));
  const partial = inScope.some((s) => s.analysis?.coverage === "sampled" || s.extractionStatus === "partial_text");
  const anyFull = inScope.some((s) => s.analysis?.coverage === "full");
  const coverage: Coverage | null = partial ? "sampled" : anyFull ? "full" : null;
  const note = partial
    ? "Partial coverage: some sources in scope were only partly analyzed. Treat findings as provisional."
    : "Sources in scope were fully analyzed within their processing limits.";
  return { coverage, partial, note };
}

/** Deterministic base result for a mode (grounded, cited). */
function deterministicResult(
  state: StoreState,
  mode: ReasoningMode,
  scope: ReasoningScope,
  graph: ReturnType<typeof buildReasoningGraph>,
  question: string,
  scopeSummary: string,
  coverageNote: string,
): ReasoningResultData {
  const base: ReasoningResultData = {
    question,
    mode,
    scopeSummary,
    keyFindings: [],
    supportingEvidence: [],
    challengingEvidence: [],
    candidateContradictions: [],
    assumptions: [],
    influenceChains: [],
    affectedBeliefs: [],
    supportAudits: [],
    unresolvedQuestions: [],
    alternativeInterpretations: [],
    limitations: [],
    coverageNote,
    questionsForHuman: [],
  };
  const r = graph.resolved;

  switch (mode) {
    case "support_audit": {
      const { audits, supporting, challenging, unresolved } = supportAudit(state, r);
      base.supportAudits = audits;
      base.supportingEvidence = supporting;
      base.challengingEvidence = challenging;
      base.unresolvedQuestions = unresolved;
      break;
    }
    case "contradiction_audit":
      base.candidateContradictions = contradictionAudit(state, r);
      break;
    case "influence_trace":
      base.influenceChains = influenceTrace(state, r, scope.beliefIds?.length === 1 ? scope.beliefIds[0] : undefined);
      break;
    case "assumption_audit":
      base.assumptions = assumptionAudit(state, r);
      break;
    case "belief_impact": {
      const { affected, unresolved } = beliefImpact(state, r, scope.proposedBelief ?? question);
      base.affectedBeliefs = affected;
      base.unresolvedQuestions = unresolved;
      break;
    }
    case "change_over_time": {
      const { findings } = changeOverTime(state, r);
      base.keyFindings = findings;
      break;
    }
    case "unresolved_synthesis": {
      const { findings, unresolved } = unresolvedSynthesis(state, r);
      base.keyFindings = findings;
      base.unresolvedQuestions = unresolved;
      break;
    }
    case "open_inquiry":
    default:
      break;
  }
  return base;
}

export function estimateReasoning(state: StoreState, mode: ReasoningMode, scope: ReasoningScope) {
  const graph = buildReasoningGraph(state, scope);
  const { partial, note } = coverageOf(state, graph.resolved.sourceIds);
  const sourceCount = graph.resolved.sourceIds.size;
  return {
    calls: graph.nodes.length >= VERIFY_NODE_THRESHOLD ? 2 : 1,
    evidenceCount: graph.evidence.length,
    nodeCount: graph.nodes.length,
    partial,
    coverageNote: note,
    sourceCount,
    tooMany: sourceCount > MAX_SCOPE_SOURCES,
  };
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `rsn_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

async function produce(state: StoreState, question: string, mode: ReasoningMode, scope: ReasoningScope) {
  const graph = buildReasoningGraph(state, scope);
  const { coverage, partial, note } = coverageOf(state, graph.resolved.sourceIds);
  const scopeSummary =
    scope.kind === "all"
      ? "your entire library"
      : `${graph.resolved.sourceIds.size} source(s), ${graph.resolved.beliefIds.size} belief(s)`;
  const validIds = new Set(graph.evidence.map((e) => e.id));

  const result = deterministicResult(state, mode, scope, graph, question, scopeSummary, note);

  const { result: raw, source } = await reasoningSynthesis({ evidence: graph.evidence, question, mode });
  const ai = validateReasoningAI(raw, validIds);
  result.keyFindings = [...result.keyFindings, ...ai.keyFindings];
  result.alternativeInterpretations = ai.alternativeInterpretations;
  result.questionsForHuman = ai.questionsForHuman;
  result.limitations = [...ai.limitations];
  if (ai.flagged.length) result.flagged = ai.flagged;

  let verified = false;
  if (graph.nodes.length >= VERIFY_NODE_THRESHOLD) {
    verified = true;
    try {
      const { result: review } = await verifyReasoning(graph.evidence, result);
      const remove = new Set((review.removeStatements ?? []).map((s) => s.trim()));
      const cautions = (review.cautions ?? []).map((s) => s.trim()).filter(Boolean);
      if (remove.size) result.keyFindings = result.keyFindings.filter((f) => !remove.has(f.statement.trim()));
      if (cautions.length) result.flagged = [...(result.flagged ?? []), ...cautions];
    } catch {
      /* best-effort */
    }
  }

  return { result, evidence: graph.evidence, source, coverage, partial, verified };
}

/** Run a fresh reasoning query. Returns an unsaved ReasoningQuery. */
export async function runReasoning(
  state: StoreState,
  question: string,
  mode: ReasoningMode,
  scope: ReasoningScope,
): Promise<ReasoningQuery> {
  if (mode === "belief_impact" && !scope.proposedBelief && !question.trim())
    throw new Error("Enter the proposed belief to analyze its impact.");
  if (!question.trim() && mode !== "belief_impact") throw new Error("Enter a question to reason about.");

  const { result, evidence, source, coverage, partial, verified } = await produce(state, question, mode, scope);
  const now = new Date().toISOString();
  const model = source === "ai" ? (process.env.NEXT_PUBLIC_ANTHROPIC_MODEL ?? "anthropic") : "mock";

  return {
    id: newId(),
    question: question.trim() || scope.proposedBelief || "",
    mode,
    scope,
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
    fingerprint: makeFingerprint(state, evidence.map((e) => e.id)),
  };
}

/** Re-run, pushing the prior result into append-only history. */
export async function rerunReasoning(
  state: StoreState,
  query: ReasoningQuery,
  newScope?: ReasoningScope,
): Promise<ReasoningQuery> {
  const scope = newScope ?? query.scope;
  const { result, evidence, source, coverage, partial, verified } = await produce(state, query.question, query.mode, scope);
  const now = new Date().toISOString();
  const model = source === "ai" ? (process.env.NEXT_PUBLIC_ANTHROPIC_MODEL ?? "anthropic") : "mock";
  return {
    ...query,
    scope,
    evidence,
    result,
    history: [...query.history, { at: query.updatedAt, result: query.result, source: query.source, scopeChanged: !!newScope }],
    aiModel: model,
    source,
    coverage,
    partial,
    verified,
    updatedAt: now,
    fingerprint: makeFingerprint(state, evidence.map((e) => e.id)),
  };
}
