/**
 * Deterministic mock decision analysis (LIFEOS-016 fallback).
 *
 * Produces an honest, evidence-cited analysis from the packet + the user's own
 * options/criteria/ratings — no AI. It never picks a winner, never invents
 * probabilities, and clearly labels itself. Output matches the AI
 * "decision_synthesis" shape so it flows through the same validator.
 */

import type { MockEvidence } from "@/lib/mockCompare";

export interface MockDecisionContext {
  question: string;
  options: { name: string; reversibility: string; benefits: string[]; costs: string[]; risks: string[] }[];
  criteria: string[];
  constraints: string[];
  assumptions: string[];
  tradeoffContext: string;
}

export function mockDecision(input: { evidence: MockEvidence[]; context: MockDecisionContext }): unknown {
  const { evidence, context } = input;
  const beliefs = evidence.filter((e) => e.group.startsWith("Belief"));
  const sourcesEtc = evidence.filter((e) => !e.group.startsWith("Belief"));
  const names = context.options.map((o) => o.name);

  const tradeoffs = names.slice(0, 4).flatMap((name) => {
    const e = sourcesEtc[0] ?? beliefs[0];
    return e
      ? [{
          statement: `“${name}” should be weighed against your recorded material — e.g. ${e.group.toLowerCase()}: “${e.text.slice(0, 100)}”.`,
          evidenceIds: [e.id],
          option: name,
        }]
      : [];
  });

  const valuesAlignment = names.slice(0, 4).flatMap((name, i) => {
    const b = beliefs[i % Math.max(1, beliefs.length)];
    return b
      ? [{
          option: name,
          verdict: "unclear",
          statement: `Whether “${name}” fits “${b.text.slice(0, 100)}” is not settled by wording alone — read them side by side.`,
          evidenceIds: [b.id],
        }]
      : [];
  });

  const assumptions = context.assumptions.slice(0, 4).map((a) => {
    const e = evidence[0];
    return e
      ? { statement: `You are assuming: ${a}. Check it against your records before deciding.`, evidenceIds: [e.id] }
      : null;
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  const strongestFor = names.slice(0, 4).flatMap((name, i) => {
    const opt = context.options[i];
    const e = beliefs[0] ?? sourcesEtc[0];
    return e && opt?.benefits.length
      ? [{ option: name, statement: `Its clearest stated benefit: ${opt.benefits[0]}.`, evidenceIds: [e.id] }]
      : [];
  });
  const strongestAgainst = names.slice(0, 4).flatMap((name, i) => {
    const opt = context.options[i];
    const e = beliefs[0] ?? sourcesEtc[0];
    return e && (opt?.costs.length || opt?.risks.length)
      ? [{ option: name, statement: `Its clearest stated cost or risk: ${opt.costs[0] ?? opt.risks[0]}.`, evidenceIds: [e.id] }]
      : [];
  });

  return {
    question: context.question,
    options: names,
    criteria: context.criteria,
    tradeoffs,
    valuesAlignment,
    assumptions,
    missingEvidence: [
      "You have not yet recorded direct evidence about how each option plays out in practice.",
      "Consider capturing a reflection on what your gut says before analyzing further.",
    ],
    risks: names.slice(0, 2).flatMap((name, i) => {
      const opt = context.options[i];
      const e = evidence[0];
      return e && opt?.risks.length ? [{ statement: `${name}: ${opt.risks[0]}`, evidenceIds: [e.id], option: name }] : [];
    }),
    reversibilityNotes: context.options.map((o) => ({
      option: o.name,
      assessment: o.reversibility,
      note: "Reversibility as you stated it — revisit if circumstances change.",
    })),
    regret: {
      regretDoing: names.map((n) => `Choosing “${n}” and discovering a stated cost mattered more than expected.`).slice(0, 3),
      regretNotDoing: names.map((n) => `Passing on “${n}” and losing an option that later proves hard to recreate.`).slice(0, 3),
      recoverableRegrets: ["Regrets tied to easily-reversible options are usually recoverable."],
    },
    preMortem: context.options.slice(0, 4).map((o) => ({
      option: o.name,
      plausibleCauses: o.risks.length ? o.risks.slice(0, 3) : ["A stated assumption turned out false."],
      preventableCauses: ["Deciding before filling the missing evidence noted above."],
      earlyWarningSigns: ["The costs you listed start appearing earlier or larger than expected."],
    })),
    scenarios: context.options.slice(0, 4).map((o) => ({
      option: o.name,
      best: o.benefits[0] ? `The stated benefit (“${o.benefits[0]}”) materializes fully.` : "The option delivers what you hoped.",
      expected: "A mix of the benefits and costs you listed, at moderate intensity.",
      worst: o.risks[0] ? `The stated risk (“${o.risks[0]}”) dominates.` : "The costs outweigh the benefits.",
      wildcard: "Something outside your listed factors changes the situation entirely.",
    })),
    strongestFor,
    strongestAgainst,
    hybridSuggestion: names.length >= 2 ? `A staged path — try a reversible slice of “${names[0]}” before ruling out “${names[1]}”.` : undefined,
    keyUncertainties: ["How each option feels lived, not just analyzed."],
    whatWouldChange: ["A revised belief directly bearing on the question.", "New evidence filling a gap listed under missing evidence."],
    questionsForHuman: [
      "Which option would you defend to the person you most respect?",
      "What are you avoiding looking at?",
      "Which regret could you live with?",
    ],
    limitations: [
      "Generated without AI (mock mode): this reorganizes YOUR stated options, criteria, and records — it adds no outside judgment.",
      context.tradeoffContext,
    ],
    coverageNote: "Based only on what you have recorded in LifeOS.",
  };
}
