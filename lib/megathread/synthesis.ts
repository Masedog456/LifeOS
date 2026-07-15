/**
 * Thread synthesis validation (LIFEOS-012, Phase 5).
 *
 * Turns loosely-parsed AI/mock JSON into a strict ThreadSynthesisData and
 * drops any substantive point that does not cite valid evidence (flagged,
 * never shown as grounded). Narrative fields (current understanding, belief
 * evolution, recent changes, unresolved questions) are non-grounded strings.
 */

import type {
  ComparisonPoint,
  DialecticPoint,
  PositionEvidence,
  TerminologyDifference,
  ThreadSynthesisData,
} from "@/types/mvp";

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

export function validateThreadSynthesis(
  raw: unknown,
  valid: Set<string>,
  fallback: { coverageNote: string },
): ThreadSynthesisData {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const flagged: string[] = [];

  const grounded = (v: unknown, kind: string): ComparisonPoint[] => {
    const arr = Array.isArray(v) ? v : [];
    const out: ComparisonPoint[] = [];
    for (const p of arr) {
      const statement = str((p as Record<string, unknown>)?.statement);
      if (!statement) continue;
      const evidenceIds = ids((p as Record<string, unknown>)?.evidenceIds, valid);
      if (evidenceIds.length === 0) {
        flagged.push(`Unsupported ${kind} (no valid evidence): "${statement.slice(0, 140)}"`);
        continue;
      }
      if (FLATTENING.test(statement)) flagged.push(`Flattening language — review: "${statement.slice(0, 120)}"`);
      out.push({ statement, evidenceIds });
    }
    return out;
  };

  const positions = (v: unknown): DialecticPoint[] => grounded(v, "position");

  const positionEvidence = (v: unknown, kind: string): PositionEvidence[] =>
    (Array.isArray(v) ? v : [])
      .map((s) => ({ position: str((s as Record<string, unknown>)?.position), evidenceIds: ids((s as Record<string, unknown>)?.evidenceIds, valid) }))
      .filter((s) => {
        if (!s.position) return false;
        if (s.evidenceIds.length === 0) {
          flagged.push(`Unsupported ${kind} (no valid evidence): "${s.position.slice(0, 120)}"`);
          return false;
        }
        return true;
      });

  const terminologyDifferences: TerminologyDifference[] = (Array.isArray(obj.terminologyDifferences) ? obj.terminologyDifferences : [])
    .map((t) => ({
      term: str((t as Record<string, unknown>)?.term),
      note: str((t as Record<string, unknown>)?.note),
      evidenceIds: ids((t as Record<string, unknown>)?.evidenceIds, valid),
    }))
    .filter((t) => t.term && t.note);

  return {
    currentUnderstanding: str(obj.currentUnderstanding),
    majorPositions: positions(obj.majorPositions),
    agreements: grounded(obj.agreements, "agreement"),
    disagreements: grounded(obj.disagreements, "disagreement"),
    terminologyDifferences,
    beliefEvolution: strArr(obj.beliefEvolution, 12),
    strongestSupport: positionEvidence(obj.strongestSupport, "supporting evidence"),
    strongestChallenge: positionEvidence(obj.strongestChallenge, "challenging evidence"),
    unresolvedQuestions: strArr(obj.unresolvedQuestions, 10),
    recentChanges: strArr(obj.recentChanges, 10),
    limitations: strArr(obj.limitations, 10),
    coverageNote: str(obj.coverageNote) || fallback.coverageNote,
    flagged: flagged.length ? flagged : undefined,
  };
}
