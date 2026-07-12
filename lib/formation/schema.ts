/**
 * Formation validation (LIFEOS-013).
 *
 * Weekly-synthesis highlights and alignment observations MUST cite real
 * record ids; uncited claims are dropped and flagged. Alignment language is
 * checked for accusatory/moralizing phrasing (Phase 7) — flagged, never shown
 * as a verdict.
 */

import type { AlignmentData, CitedClaim, WeeklySynthesisData } from "@/types/mvp";

/** Accusatory / moralizing phrasing the alignment review must avoid (Phase 7). */
const ACCUSATORY = /\b(you failed|hypocri\w*|you should|you must|you ought|shame|lazy|weak|betray\w*|you never|you always)\b/i;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function strArr(v: unknown, n = 20): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()).slice(0, n)
    : [];
}
function recordIds(v: unknown, valid: Set<string>): string[] {
  return Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => x.trim()))].filter((x) => valid.has(x))
    : [];
}

function citedClaims(
  v: unknown,
  valid: Set<string>,
  kind: string,
  flagged: string[],
  guard?: (s: string) => void,
): CitedClaim[] {
  const arr = Array.isArray(v) ? v : [];
  const out: CitedClaim[] = [];
  for (const p of arr) {
    const statement = str((p as Record<string, unknown>)?.statement);
    if (!statement) continue;
    const ids = recordIds((p as Record<string, unknown>)?.recordIds, valid);
    if (ids.length === 0) {
      flagged.push(`Unsupported ${kind} (no valid record): "${statement.slice(0, 140)}"`);
      continue;
    }
    if (guard) guard(statement);
    out.push({ statement, recordIds: ids });
  }
  return out;
}

export function validateWeeklySynthesis(
  raw: unknown,
  valid: Set<string>,
  fallback: { narrative?: string },
): WeeklySynthesisData {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const flagged: string[] = [];
  return {
    narrative: str(obj.narrative) || fallback.narrative || "",
    highlights: citedClaims(obj.highlights, valid, "highlight", flagged),
    recurringConcepts: strArr(obj.recurringConcepts, 10),
    unresolvedTensions: strArr(obj.unresolvedTensions, 10),
    changesFromLastWeek: strArr(obj.changesFromLastWeek, 10),
    limitations: strArr(obj.limitations, 10),
    flagged: flagged.length ? flagged : undefined,
  };
}

export function validateAlignment(raw: unknown, valid: Set<string>): AlignmentData {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const flagged: string[] = [];
  const observations = citedClaims(obj.observations, valid, "observation", flagged, (s) => {
    if (ACCUSATORY.test(s)) flagged.push(`Softened — accusatory phrasing removed from an observation.`);
  }).filter((o) => !ACCUSATORY.test(o.statement)); // never surface accusatory statements
  return {
    observations,
    questions: strArr(obj.questions, 8),
    limitations: strArr(obj.limitations, 10),
    flagged: flagged.length ? flagged : undefined,
  };
}
