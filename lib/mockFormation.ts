/**
 * Deterministic formation mocks (LIFEOS-013 fallback).
 *
 * Weekly synthesis, alignment reflection, and practice suggestions all work
 * offline. They cite real record ids from the packet, never invent evidence,
 * use cautious wording, and propose only modest, safe practices.
 */

import type { MockEvidence } from "@/lib/mockCompare";

export function mockWeeklySynthesis(input: { evidence: MockEvidence[]; summary: string }): unknown {
  const { evidence } = input;
  const highlights = evidence.slice(0, 5).map((e) => ({
    statement: `${e.group}: “${e.text.slice(0, 120)}”.`,
    recordIds: [e.id],
  }));
  return {
    narrative:
      evidence.length > 0
        ? `This week you engaged ${evidence.length} record${evidence.length === 1 ? "" : "s"}. ${input.summary} (Generated without AI — a plain roll-up of your activity.)`
        : "A quiet week — nothing new was recorded.",
    highlights,
    recurringConcepts: [],
    unresolvedTensions: [],
    changesFromLastWeek: [],
    limitations: ["Generated without AI (mock mode): this is a factual roll-up, not an interpretive summary."],
  };
}

export function mockAlignment(input: { evidence: MockEvidence[] }): unknown {
  const beliefs = input.evidence.filter((e) => e.group === "Belief you hold");
  const reflections = input.evidence.filter((e) => e.group === "Your reflection");
  const reflectedText = reflections.map((r) => r.text.toLowerCase()).join(" ");

  // Cautious: a belief you hold that no reflection has touched → gently ask.
  const observations = beliefs
    .filter((b) => {
      const key = b.text.toLowerCase().split(/\s+/).filter((w) => w.length > 4)[0];
      return key ? !reflectedText.includes(key) : true;
    })
    .slice(0, 3)
    .map((b) => ({
      statement: `You reported holding “${b.text.slice(0, 120)}”, and haven't reflected on living it recently. This may be worth examining — would you like to?`,
      recordIds: [b.id],
    }));

  return {
    observations,
    questions: [
      "Is there a belief here you have not lived out as fully as you'd like?",
      "Would writing a short reflection help you see where you stand?",
    ],
    limitations: [
      "Generated without AI (mock mode). Based only on what you explicitly recorded — absence of data is never read as evidence about your life.",
    ],
  };
}

export function mockPractices(input: { evidence: MockEvidence[] }): unknown {
  const seed = input.evidence[0];
  if (!seed) return { practices: [] };
  const subject = seed.text.slice(0, 80);
  return {
    practices: [
      {
        title: "A short reflective note",
        description: `Spend five minutes writing about how “${subject}” showed up in your day.`,
        rationale: `Follows directly from ${seed.group.toLowerCase()}: “${subject}”.`,
        cadence: "daily",
      },
      {
        title: "One quiet reading",
        description: `Re-read a short passage related to “${subject}” and note one line that strikes you.`,
        rationale: `Keeps you in contact with the material behind ${seed.group.toLowerCase()}.`,
        cadence: "weekly",
      },
    ],
  };
}
