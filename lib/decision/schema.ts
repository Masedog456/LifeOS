/**
 * Decision analysis validation (LIFEOS-016, Phase 7).
 *
 * Grounded findings (tradeoffs, values alignment, assumptions, risks,
 * strongest cases) MUST cite valid evidence ids — uncited ones are dropped and
 * flagged. Prescriptive or falsely-certain language ("you should choose",
 * "clearly the best", fabricated probabilities) is flagged: LifeOS clarifies,
 * it does not choose. Speculative sections (scenarios, pre-mortem, regret,
 * missing evidence) are bounded but not citation-gated — they are prompts for
 * the user's imagination, not claims about records.
 */

import type {
  AlignmentVerdict,
  DecisionAnalysisResult,
  DecisionFinding,
  OptionCase,
  OptionScenarios,
  PreMortemEntry,
  Reversibility,
  ValuesAlignment,
} from "@/types/mvp";

const PRESCRIPTIVE = /\b(you should (choose|pick|take|accept)|the (right|correct|best) (choice|option) is|clearly the best|you must choose|obvious(ly)? choose)\b/i;
const FALSE_CERTAINTY = /\b(guarantee[ds]?|certainly succeed|definitely|without doubt|can't fail|risk.?free|\d{1,3}\s?% (chance|likely|probability))\b/i;
const VERDICTS: AlignmentVerdict[] = ["supports", "conflicts", "mixed", "unclear"];
const REVERSIBILITY: Reversibility[] = ["easily_reversible", "costly_to_reverse", "irreversible", "unknown"];

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

export function validateDecisionAnalysis(
  raw: unknown,
  valid: Set<string>,
  fallback: { question: string; options: string[]; criteria: string[]; coverageNote: string },
): DecisionAnalysisResult {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const flagged: string[] = [];

  const tone = (s: string) => {
    if (PRESCRIPTIVE.test(s)) flagged.push(`Prescriptive language softened — LifeOS never chooses: "${s.slice(0, 120)}"`);
    if (FALSE_CERTAINTY.test(s)) flagged.push(`Overclaims certainty/probability — read cautiously: "${s.slice(0, 120)}"`);
  };

  const grounded = (v: unknown, kind: string): DecisionFinding[] => {
    const arr = Array.isArray(v) ? v : [];
    const out: DecisionFinding[] = [];
    for (const p of arr.slice(0, 24)) {
      const statement = str((p as Record<string, unknown>)?.statement);
      if (!statement) continue;
      const evidenceIds = ids((p as Record<string, unknown>)?.evidenceIds, valid);
      if (evidenceIds.length === 0) {
        flagged.push(`Unsupported ${kind} (no valid evidence): "${statement.slice(0, 140)}"`);
        continue;
      }
      tone(statement);
      out.push({ statement, evidenceIds, option: str((p as Record<string, unknown>)?.option) || undefined });
    }
    return out;
  };

  const valuesAlignment: ValuesAlignment[] = (Array.isArray(obj.valuesAlignment) ? obj.valuesAlignment : [])
    .slice(0, 24)
    .map((p) => {
      const o = p as Record<string, unknown>;
      const rawVerdict = str(o.verdict) as AlignmentVerdict;
      return {
        option: str(o.option),
        // Values alignment never claims certainty — unknown verdicts become "unclear".
        verdict: VERDICTS.includes(rawVerdict) ? rawVerdict : "unclear",
        statement: str(o.statement),
        evidenceIds: ids(o.evidenceIds, valid),
      };
    })
    .filter((v) => {
      if (!v.option || !v.statement) return false;
      if (v.evidenceIds.length === 0) {
        flagged.push(`Unsupported values-alignment claim (cites no belief): "${v.statement.slice(0, 120)}"`);
        return false;
      }
      tone(v.statement);
      return true;
    });

  const cases = (v: unknown, kind: string): OptionCase[] =>
    (Array.isArray(v) ? v : [])
      .slice(0, 16)
      .map((p) => {
        const o = p as Record<string, unknown>;
        return { option: str(o.option), statement: str(o.statement), evidenceIds: ids(o.evidenceIds, valid) };
      })
      .filter((c) => {
        if (!c.option || !c.statement) return false;
        if (c.evidenceIds.length === 0) {
          flagged.push(`Unsupported ${kind} (no valid evidence): "${c.statement.slice(0, 120)}"`);
          return false;
        }
        tone(c.statement);
        return true;
      });

  const scenarios: OptionScenarios[] = (Array.isArray(obj.scenarios) ? obj.scenarios : [])
    .slice(0, 8)
    .map((p) => {
      const o = p as Record<string, unknown>;
      const s = { option: str(o.option), best: str(o.best), expected: str(o.expected), worst: str(o.worst), wildcard: str(o.wildcard) };
      [s.best, s.expected, s.worst, s.wildcard].forEach(tone);
      return s;
    })
    .filter((s) => s.option && (s.best || s.expected || s.worst));

  const preMortem: PreMortemEntry[] = (Array.isArray(obj.preMortem) ? obj.preMortem : [])
    .slice(0, 8)
    .map((p) => {
      const o = p as Record<string, unknown>;
      return {
        option: str(o.option),
        plausibleCauses: strArr(o.plausibleCauses, 5),
        preventableCauses: strArr(o.preventableCauses, 5),
        earlyWarningSigns: strArr(o.earlyWarningSigns, 5),
      };
    })
    .filter((p) => p.option && p.plausibleCauses.length > 0);

  const regretRaw = (obj.regret ?? {}) as Record<string, unknown>;
  const reversibilityNotes = (Array.isArray(obj.reversibilityNotes) ? obj.reversibilityNotes : [])
    .slice(0, 8)
    .map((p) => {
      const o = p as Record<string, unknown>;
      const a = str(o.assessment) as Reversibility;
      return { option: str(o.option), assessment: REVERSIBILITY.includes(a) ? a : "unknown" as Reversibility, note: str(o.note) };
    })
    .filter((r) => r.option);

  const hybrid = str(obj.hybridSuggestion) || undefined;
  if (hybrid) tone(hybrid);

  return {
    question: str(obj.question) || fallback.question,
    options: strArr(obj.options, 8).length ? strArr(obj.options, 8) : fallback.options,
    criteria: strArr(obj.criteria, 12).length ? strArr(obj.criteria, 12) : fallback.criteria,
    tradeoffs: grounded(obj.tradeoffs, "tradeoff"),
    valuesAlignment,
    assumptions: grounded(obj.assumptions, "assumption"),
    missingEvidence: strArr(obj.missingEvidence, 8),
    risks: grounded(obj.risks, "risk"),
    reversibilityNotes,
    regret: {
      regretDoing: strArr(regretRaw.regretDoing, 6),
      regretNotDoing: strArr(regretRaw.regretNotDoing, 6),
      recoverableRegrets: strArr(regretRaw.recoverableRegrets, 6),
    },
    preMortem,
    scenarios,
    strongestFor: cases(obj.strongestFor, "strongest-case-for"),
    strongestAgainst: cases(obj.strongestAgainst, "strongest-case-against"),
    hybridSuggestion: hybrid,
    keyUncertainties: strArr(obj.keyUncertainties, 8),
    whatWouldChange: strArr(obj.whatWouldChange, 8),
    questionsForHuman: strArr(obj.questionsForHuman, 8),
    limitations: strArr(obj.limitations, 10),
    coverageNote: str(obj.coverageNote) || fallback.coverageNote,
    flagged: flagged.length ? flagged : undefined,
  };
}
