/**
 * Deterministic tradeoff calculations (LIFEOS-016, Phases 4/6).
 *
 * Pure arithmetic over the USER'S OWN ratings and optional weights — no AI.
 * Weighted totals are explicitly ONE PERSPECTIVE: they surface how the user's
 * stated criteria and ratings combine, and must never be presented as "the
 * answer" or with implied mathematical precision.
 */

import type { Decision, DecisionCriterion, DecisionOption } from "@/types/mvp";

export interface OptionTally {
  optionId: string;
  optionName: string;
  /** Sum of weight × rating over rated criteria. */
  weightedTotal: number;
  /** How many criteria the user actually rated for this option. */
  ratedCriteria: number;
  totalCriteria: number;
}

export interface CriterionLeader {
  criterionId: string;
  criterionName: string;
  /** Option names sharing the top rating on this criterion (ties preserved). */
  leaders: string[];
}

export interface TradeoffSummary {
  tallies: OptionTally[];
  leaders: CriterionLeader[];
  /** True when every option×criterion cell is unrated — nothing to compute. */
  empty: boolean;
}

function ratingOf(d: Decision, optionId: string, criterionId: string): number | undefined {
  return d.ratings[optionId]?.[criterionId];
}

function weightOf(c: DecisionCriterion): number {
  // Unweighted criteria count equally (weight 3 of 5) — a neutral default,
  // not a claim of precision.
  return c.weight ?? 3;
}

export function computeTradeoffs(d: Decision): TradeoffSummary {
  const tallies: OptionTally[] = d.options.map((o: DecisionOption) => {
    let total = 0;
    let rated = 0;
    for (const c of d.criteria) {
      const r = ratingOf(d, o.id, c.id);
      if (r === undefined) continue;
      rated++;
      total += weightOf(c) * r;
    }
    return {
      optionId: o.id,
      optionName: o.name,
      weightedTotal: total,
      ratedCriteria: rated,
      totalCriteria: d.criteria.length,
    };
  });

  const leaders: CriterionLeader[] = [];
  for (const c of d.criteria) {
    let best = -Infinity;
    let names: string[] = [];
    for (const o of d.options) {
      const r = ratingOf(d, o.id, c.id);
      if (r === undefined) continue;
      if (r > best) {
        best = r;
        names = [o.name];
      } else if (r === best) {
        names.push(o.name);
      }
    }
    if (names.length > 0 && best > -Infinity) {
      leaders.push({ criterionId: c.id, criterionName: c.name, leaders: names });
    }
  }

  const empty = tallies.every((t) => t.ratedCriteria === 0);
  return { tallies, leaders, empty };
}

/** Compact, human-readable summary passed to the AI as deterministic context. */
export function tradeoffContext(d: Decision): string {
  const { tallies, leaders, empty } = computeTradeoffs(d);
  if (empty) return "The user has not rated options against criteria yet.";
  const lines = tallies.map(
    (t) => `${t.optionName}: weighted total ${t.weightedTotal} (${t.ratedCriteria}/${t.totalCriteria} criteria rated)`,
  );
  for (const l of leaders) lines.push(`Criterion "${l.criterionName}": strongest = ${l.leaders.join(", ")}`);
  lines.push("These user-supplied ratings are one perspective, not a verdict.");
  return lines.join("\n");
}
