/**
 * Comparison result validation + deterministic verification (LIFEOS-010,
 * Phases 4, 7, 8). Turns loosely-parsed AI/mock JSON into a strict
 * ComparisonResultData, and — critically — rejects any synthesized point
 * that does not cite valid evidence. Unsupported prose is never shown as a
 * conclusion; it is dropped and flagged.
 */

import type {
  ComparisonPoint,
  ComparisonResultData,
  ContradictionKind,
  Disagreement,
  PositionEvidence,
  TerminologyDifference,
} from "@/types/mvp";

const CONTRADICTION_KINDS: ContradictionKind[] = [
  "logical",
  "practical",
  "definitional",
  "level_of_analysis",
  "historical",
  "ambiguity",
];

/** Absolute-equivalence phrasing that flattens distinct traditions (Phase 7). */
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

/**
 * Validate + normalize. `valid` is the set of real evidence ids in the
 * packet. Points that must cite evidence but cite none valid are dropped
 * into `flagged` (Phase 4: no unsupported prose; Phase 11 #8).
 */
export function validateResult(
  raw: unknown,
  valid: Set<string>,
  fallback: { title: string; question: string; sourcesCompared: string[]; coverageNote: string },
): ComparisonResultData {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const flagged: string[] = [];

  // Points that MUST be grounded — drop + flag if they cite no valid evidence.
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
      out.push({ statement, evidenceIds });
    }
    return out;
  };

  const disagreements: Disagreement[] = (Array.isArray(obj.disagreements) ? obj.disagreements : [])
    .map((p) => {
      const statement = str((p as Record<string, unknown>)?.statement);
      const evidenceIds = ids((p as Record<string, unknown>)?.evidenceIds, valid);
      const rawKind = str((p as Record<string, unknown>)?.kind) as ContradictionKind;
      const kind: ContradictionKind = CONTRADICTION_KINDS.includes(rawKind) ? rawKind : "ambiguity";
      return { statement, evidenceIds, kind };
    })
    .filter((d) => {
      if (!d.statement) return false;
      if (d.evidenceIds.length === 0) {
        flagged.push(`Unsupported disagreement (no valid evidence): "${d.statement.slice(0, 140)}"`);
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

  const strongestEvidence: PositionEvidence[] = (Array.isArray(obj.strongestEvidence) ? obj.strongestEvidence : [])
    .map((s) => ({
      position: str((s as Record<string, unknown>)?.position),
      evidenceIds: ids((s as Record<string, unknown>)?.evidenceIds, valid),
    }))
    .filter((s) => {
      if (!s.position) return false;
      if (s.evidenceIds.length === 0) {
        flagged.push(`Unsupported "strongest evidence" (no valid evidence): "${s.position.slice(0, 120)}"`);
        return false;
      }
      return true;
    });

  const agreements = grounded(obj.agreements, "agreement");

  // Phase 7: flag (do not silently accept) false-equivalence phrasing.
  for (const a of agreements) {
    if (FLATTENING.test(a.statement)) {
      flagged.push(`Flattening language softened — review: "${a.statement.slice(0, 140)}"`);
    }
  }
  for (const t of terminologyDifferences) {
    if (FLATTENING.test(t.note)) {
      flagged.push(`Terminology described as equivalent — review "${t.term}".`);
    }
  }

  return {
    title: str(obj.title) || fallback.title,
    question: str(obj.question) || fallback.question,
    sourcesCompared: strArr(obj.sourcesCompared).length ? strArr(obj.sourcesCompared) : fallback.sourcesCompared,
    sharedConcepts: strArr(obj.sharedConcepts, 12),
    agreements,
    disagreements,
    terminologyDifferences,
    assumptions: grounded(obj.assumptions, "assumption"),
    strongestEvidence,
    unresolvedTensions: grounded(obj.unresolvedTensions, "unresolved tension"),
    questionsForUser: strArr(obj.questionsForUser, 8),
    relationToBeliefs: grounded(obj.relationToBeliefs, "relation-to-belief"),
    limitations: strArr(obj.limitations, 10),
    coverageNote: str(obj.coverageNote) || fallback.coverageNote,
    flagged: flagged.length ? flagged : undefined,
  };
}

/** Every evidence id referenced anywhere in the result (for cross-checks/tests). */
export function referencedEvidenceIds(r: ComparisonResultData): Set<string> {
  const out = new Set<string>();
  const add = (arr: { evidenceIds: string[] }[]) => arr.forEach((p) => p.evidenceIds.forEach((id) => out.add(id)));
  add(r.agreements);
  add(r.disagreements);
  add(r.terminologyDifferences);
  add(r.assumptions);
  add(r.strongestEvidence);
  add(r.unresolvedTensions);
  add(r.relationToBeliefs);
  return out;
}
