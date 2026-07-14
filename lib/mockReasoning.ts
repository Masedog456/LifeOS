/**
 * Deterministic mock reasoning synthesis (LIFEOS-014 fallback).
 *
 * Adds a modest narrative layer over the deterministic passes, citing real
 * evidence ids and never overclaiming. Matches the shape the AI
 * "reasoning_synthesis" task returns, so it flows through the same validator.
 */

import type { MockEvidence } from "@/lib/mockCompare";

export function mockReasoning(input: { evidence: MockEvidence[]; question: string; mode: string }): unknown {
  const keyFindings = input.evidence.slice(0, 4).map((e) => ({
    statement: `${e.group} “${e.text.slice(0, 100)}” is relevant to this question.`,
    evidenceIds: [e.id],
  }));
  return {
    keyFindings,
    alternativeInterpretations: [
      "The deterministic findings below may read differently depending on how you weigh each source.",
    ],
    questionsForHuman: [
      "Which of these findings matters most to you right now?",
      "Is there a finding you'd like to turn into a belief or a new inquiry?",
    ],
    limitations: [
      "Generated without AI (mock mode): the narrative is a plain surfacing of your records, not fresh reasoning. The grounded findings below come from deterministic analysis.",
    ],
  };
}
