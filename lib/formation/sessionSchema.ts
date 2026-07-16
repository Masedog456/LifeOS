/**
 * Formation-synthesis validation (LIFEOS-017, Phase 5).
 *
 * `possibleBeliefRevisions` MUST cite valid evidence ids — uncited ones are
 * dropped and flagged. Prescriptive, moralizing, or falsely-certain language
 * ("you should", "you must", "this proves", "you failed") is softened away:
 * a reflection synthesis surfaces possibilities, it never issues verdicts.
 * The speculative lists (themes, follow-ups, questions) are bounded but not
 * citation-gated — they are prompts for the user, not claims about records.
 */

import type { FormationFinding, FormationSynthesisData } from "@/types/mvp";

const MORALIZING = /\b(you should|you must|you ought|you failed|you always|you never|shame|sinful|lazy|weak|hypocri\w*)\b/i;
const FALSE_CERTAINTY = /\b(prove[sd]?|definitely|certainly|without doubt|obviously true|clearly you|this means you are)\b/i;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function strArr(v: unknown, n = 10): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()).slice(0, n)
    : [];
}
function ids(v: unknown, valid: Set<string>): string[] {
  return Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => x.trim()))].filter((x) => valid.has(x))
    : [];
}

export function validateFormationSynthesis(
  raw: unknown,
  valid: Set<string>,
  fallback: { coverageNote: string },
): FormationSynthesisData {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const flagged: string[] = [];

  const tone = (s: string) => {
    if (MORALIZING.test(s)) flagged.push(`Softened — moralizing phrasing removed: "${s.slice(0, 120)}"`);
    if (FALSE_CERTAINTY.test(s)) flagged.push(`Overclaims certainty — read as a possibility, not a verdict: "${s.slice(0, 120)}"`);
  };

  // Grounded belief-revision suggestions must cite a real record.
  const possibleBeliefRevisions: FormationFinding[] = (Array.isArray(obj.possibleBeliefRevisions) ? obj.possibleBeliefRevisions : [])
    .slice(0, 12)
    .map((p) => {
      const o = p as Record<string, unknown>;
      return { statement: str(o.statement), evidenceIds: ids(o.evidenceIds, valid) };
    })
    .filter((f) => {
      if (!f.statement) return false;
      if (f.evidenceIds.length === 0) {
        flagged.push(`Unsupported belief-revision suggestion (cites no record): "${f.statement.slice(0, 120)}"`);
        return false;
      }
      if (MORALIZING.test(f.statement)) {
        flagged.push("Dropped a moralizing belief-revision suggestion.");
        return false;
      }
      tone(f.statement);
      return true;
    });

  // Speculative lists — softened for tone but not citation-gated.
  const softList = (v: unknown, n: number): string[] =>
    strArr(v, n).filter((s) => {
      if (MORALIZING.test(s)) return false; // never surface moralizing prompts
      tone(s);
      return true;
    });

  return {
    themes: softList(obj.themes, 8),
    recurringTensions: softList(obj.recurringTensions, 8),
    possibleBeliefRevisions,
    possibleDecisionFollowups: softList(obj.possibleDecisionFollowups, 6),
    possibleInquiryFollowups: softList(obj.possibleInquiryFollowups, 6),
    possibleThreadAdditions: softList(obj.possibleThreadAdditions, 6),
    possiblePractices: softList(obj.possiblePractices, 6),
    questionsWorthRevisiting: softList(obj.questionsWorthRevisiting, 8),
    itemsNeedingEvidence: softList(obj.itemsNeedingEvidence, 8),
    limitations: strArr(obj.limitations, 10),
    coverageNote: str(obj.coverageNote) || fallback.coverageNote,
    flagged: flagged.length ? flagged : undefined,
  };
}
