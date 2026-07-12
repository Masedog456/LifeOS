/**
 * Dialectic result validation + verification (LIFEOS-011, Phases 4, 5).
 *
 * Turns loosely-parsed AI/mock JSON into a strict DialecticResultData, and
 * drops any SUBSTANTIVE assertion that does not cite valid evidence (moved to
 * `flagged`, never shown as a grounded claim). Also flags false-certainty and
 * flattening language, and clamps argument/fallacy tags to known values.
 */

import type {
  ArgumentType,
  DialecticDefinition,
  DialecticPoint,
  DialecticResultData,
  FallacyType,
  PositionEvidence,
  ReasoningIssue,
  TerminologyDifference,
} from "@/types/mvp";

const ARG_TYPES: ArgumentType[] = [
  "premise", "conclusion", "objection", "rebuttal", "qualification", "analogy",
  "definition", "empirical", "interpretive", "theological", "personal_judgment",
];
const FALLACY_TYPES: FallacyType[] = [
  "invalid_inference", "hidden_assumption", "equivocation", "circular_reasoning", "unsupported_generalization",
];

/** Overclaiming that reasoning over interpretive evidence cannot support (Phase 5). */
const FALSE_CERTAINTY = /\b(proves?|proven|certainly|definitively|without doubt|beyond doubt|indisputabl\w*|conclusively)\b/i;
const FLATTENING = /\b(identical|exactly the same|the same as|equivalent to|no difference|interchangeable)\b/i;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function strArr(v: unknown, n = 20): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()).slice(0, n)
    : [];
}
function ids(v: unknown, valid: Set<string>): string[] {
  return Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => x.trim()))].filter((x) => valid.has(x))
    : [];
}
function argType(v: unknown): ArgumentType | undefined {
  const s = str(v) as ArgumentType;
  return ARG_TYPES.includes(s) ? s : undefined;
}

export function validateDialectic(
  raw: unknown,
  valid: Set<string>,
  fallback: { question: string; coverageNote: string },
): DialecticResultData {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const flagged: string[] = [];

  const grounded = (v: unknown, kind: string): DialecticPoint[] => {
    const arr = Array.isArray(v) ? v : [];
    const out: DialecticPoint[] = [];
    for (const p of arr) {
      const statement = str((p as Record<string, unknown>)?.statement);
      if (!statement) continue;
      const evidenceIds = ids((p as Record<string, unknown>)?.evidenceIds, valid);
      if (evidenceIds.length === 0) {
        flagged.push(`Unsupported ${kind} (no valid evidence): "${statement.slice(0, 140)}"`);
        continue;
      }
      if (FALSE_CERTAINTY.test(statement)) {
        flagged.push(`Overclaims certainty — read cautiously: "${statement.slice(0, 140)}"`);
      }
      out.push({ statement, evidenceIds, argType: argType((p as Record<string, unknown>)?.argType) });
    }
    return out;
  };

  const definitions: DialecticDefinition[] = (Array.isArray(obj.definitions) ? obj.definitions : [])
    .map((d) => ({ term: str((d as Record<string, unknown>)?.term), definition: str((d as Record<string, unknown>)?.definition) }))
    .filter((d) => d.term && d.definition)
    .slice(0, 8);

  const supportingEvidence: PositionEvidence[] = (Array.isArray(obj.supportingEvidence) ? obj.supportingEvidence : [])
    .map((s) => ({ position: str((s as Record<string, unknown>)?.position), evidenceIds: ids((s as Record<string, unknown>)?.evidenceIds, valid) }))
    .filter((s) => {
      if (!s.position) return false;
      if (s.evidenceIds.length === 0) {
        flagged.push(`Unsupported supporting-evidence entry: "${s.position.slice(0, 120)}"`);
        return false;
      }
      return true;
    });

  const terminologyDisputes: TerminologyDifference[] = (Array.isArray(obj.terminologyDisputes) ? obj.terminologyDisputes : [])
    .map((t) => ({
      term: str((t as Record<string, unknown>)?.term),
      note: str((t as Record<string, unknown>)?.note),
      evidenceIds: ids((t as Record<string, unknown>)?.evidenceIds, valid),
    }))
    .filter((t) => t.term && t.note);

  const reasoningIssues: ReasoningIssue[] = (Array.isArray(obj.reasoningIssues) ? obj.reasoningIssues : [])
    .map((r) => {
      const kind = str((r as Record<string, unknown>)?.kind) as FallacyType;
      return {
        kind: FALLACY_TYPES.includes(kind) ? kind : "unsupported_generalization",
        note: str((r as Record<string, unknown>)?.note),
        evidenceIds: ids((r as Record<string, unknown>)?.evidenceIds, valid),
      };
    })
    .filter((r) => r.note);

  const affirmativeCase = grounded(obj.affirmativeCase, "affirmative point");
  const negativeCase = grounded(obj.negativeCase, "negative point");
  for (const p of [...affirmativeCase, ...negativeCase]) {
    if (FLATTENING.test(p.statement)) flagged.push(`Flattening language — review: "${p.statement.slice(0, 120)}"`);
  }

  return {
    question: str(obj.question) || fallback.question,
    definitions,
    assumptions: grounded(obj.assumptions, "assumption"),
    affirmativeCase,
    negativeCase,
    supportingEvidence,
    counterarguments: grounded(obj.counterarguments, "counterargument"),
    rebuttals: grounded(obj.rebuttals, "rebuttal"),
    terminologyDisputes,
    distinctions: strArr(obj.distinctions, 10),
    unresolvedAmbiguities: strArr(obj.unresolvedAmbiguities, 10),
    // Syntheses are generative proposals — cite evidence when possible but
    // not required (they are explicitly speculative, not claims about sources).
    possibleSyntheses: (Array.isArray(obj.possibleSyntheses) ? obj.possibleSyntheses : [])
      .map((p) => ({ statement: str((p as Record<string, unknown>)?.statement), evidenceIds: ids((p as Record<string, unknown>)?.evidenceIds, valid) }))
      .filter((p) => p.statement)
      .slice(0, 6),
    evidenceThatWouldChange: strArr(obj.evidenceThatWouldChange, 8),
    questionsForHuman: strArr(obj.questionsForHuman, 8),
    relationToBeliefs: grounded(obj.relationToBeliefs, "relation-to-belief"),
    reasoningIssues,
    limitations: strArr(obj.limitations, 10),
    coverageNote: str(obj.coverageNote) || fallback.coverageNote,
    flagged: flagged.length ? flagged : undefined,
  };
}
