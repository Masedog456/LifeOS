/**
 * Deterministic mock formation synthesis (LIFEOS-017 fallback).
 *
 * Produces an honest, evidence-cited synthesis of one reflection from the
 * packet + the user's own structured capture — no AI. It never issues
 * verdicts, never moralizes, and clearly labels itself. Output matches the AI
 * "formation_synthesis" shape so it flows through the same validator.
 */

import type { MockEvidence } from "@/lib/mockCompare";

export interface MockFormationContext {
  reflection: string;
  lessons: string[];
  unresolvedQuestions: string[];
  emotionalObservations: string[];
  revisedAssumptions: string[];
  beliefCandidates: string[];
}

function words(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 5);
}

export function mockFormationSynthesis(input: { evidence: MockEvidence[]; context: MockFormationContext }): unknown {
  const { evidence, context } = input;
  const beliefs = evidence.filter((e) => e.group.startsWith("Belief"));

  // Themes: the most frequent substantive words across reflection + capture.
  const bag = [
    context.reflection,
    ...context.lessons,
    ...context.emotionalObservations,
    ...context.revisedAssumptions,
  ].join(" ");
  const counts = new Map<string, number>();
  for (const w of words(bag)) counts.set(w, (counts.get(w) ?? 0) + 1);
  const themes = [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([w]) => w);

  // Belief-revision suggestions: beliefs the reflection's words touch.
  const reflWords = new Set(words(bag));
  const possibleBeliefRevisions = beliefs
    .filter((b) => words(b.text).some((w) => reflWords.has(w)))
    .slice(0, 4)
    .map((b) => ({
      statement: `Your reflection may bear on “${b.text.slice(0, 110)}” — read them side by side and decide if it still holds.`,
      evidenceIds: [b.id],
    }));

  return {
    themes,
    recurringTensions: context.unresolvedQuestions.slice(0, 4),
    possibleBeliefRevisions,
    possibleDecisionFollowups: context.revisedAssumptions.length
      ? ["A revised assumption here may touch a past or pending decision — consider a Decision Review."]
      : [],
    possibleInquiryFollowups: context.unresolvedQuestions.length
      ? ["One of your unresolved questions could become a dialectical inquiry if you want to reason it through."]
      : [],
    possibleThreadAdditions: themes.length
      ? [`This reflection could join a thread on “${themes[0]}” if you keep returning to it.`]
      : [],
    possiblePractices: context.lessons.length
      ? ["A lesson you named might translate into one small, optional practice — you decide."]
      : [],
    questionsWorthRevisiting: [
      ...context.unresolvedQuestions.slice(0, 2),
      "What would you want to have understood the next time you reflect on this?",
    ],
    itemsNeedingEvidence: context.beliefCandidates.length
      ? ["A belief candidate here rests on this single reflection — look for corroboration before adopting it."]
      : ["This reflection stands largely on its own; more experience over time would test it."],
    limitations: [
      "Generated without AI (mock mode): this reorganizes YOUR reflection and records — it adds no outside interpretation.",
      "Based only on what you recorded — absence of a record is never read as evidence about your life.",
    ],
    coverageNote: "Based only on what you have recorded in LifeOS.",
  };
}
