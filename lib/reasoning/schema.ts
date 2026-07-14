/**
 * Reasoning AI-layer validation (LIFEOS-014, Phase 5).
 *
 * The deterministic passes produce the grounded result; the AI adds a narrative
 * layer (key findings, alternative interpretations, questions). Any AI finding
 * that does not cite valid record ids is dropped and flagged — unsupported
 * synthesis never appears as a conclusion.
 */

import type { ReasoningFinding } from "@/types/mvp";

const OVERCONFIDENT = /\b(proves?|proven|certainly|definitively|without doubt|undeniably|conclusively)\b/i;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function strArr(v: unknown, n = 12): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()).slice(0, n)
    : [];
}
function ids(v: unknown, valid: Set<string>): string[] {
  return Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => x.trim()))].filter((x) => valid.has(x))
    : [];
}

export interface ReasoningAILayer {
  keyFindings: ReasoningFinding[];
  alternativeInterpretations: string[];
  questionsForHuman: string[];
  limitations: string[];
  flagged: string[];
}

export function validateReasoningAI(raw: unknown, valid: Set<string>): ReasoningAILayer {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const flagged: string[] = [];
  const arr = Array.isArray(obj.keyFindings) ? obj.keyFindings : [];
  const keyFindings: ReasoningFinding[] = [];
  for (const p of arr) {
    const statement = str((p as Record<string, unknown>)?.statement);
    if (!statement) continue;
    const evidenceIds = ids((p as Record<string, unknown>)?.evidenceIds, valid);
    if (evidenceIds.length === 0) {
      flagged.push(`Unsupported finding (no valid evidence): "${statement.slice(0, 140)}"`);
      continue;
    }
    if (OVERCONFIDENT.test(statement)) flagged.push(`Overclaims certainty — read cautiously: "${statement.slice(0, 120)}"`);
    keyFindings.push({ statement, evidenceIds });
  }
  return {
    keyFindings,
    alternativeInterpretations: strArr(obj.alternativeInterpretations),
    questionsForHuman: strArr(obj.questionsForHuman),
    limitations: strArr(obj.limitations),
    flagged,
  };
}
