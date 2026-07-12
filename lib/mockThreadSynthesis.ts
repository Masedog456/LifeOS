/**
 * Deterministic mock thread synthesis (LIFEOS-012, Phase 6 fallback).
 *
 * Produces a real, evidence-cited synthesis from the packet alone — no AI.
 * Positions come from source summaries, agreements/disagreements from prior
 * comparison/inquiry findings, support from the longest quotes. It never
 * invents evidence. Output matches the shape the AI "thread_synthesis" task
 * returns, so it flows through the same validator.
 */

import type { MockEvidence } from "@/lib/mockCompare";

interface MockInput {
  evidence: MockEvidence[];
  title: string;
  coverageNote: string;
}

export function mockThreadSynthesis(input: MockInput): unknown {
  const { evidence } = input;
  const beliefs = evidence.filter((e) => e.kind === "belief");
  const summaries = evidence.filter((e) => e.kind === "summary" || e.kind === "metadata");
  const quotes = evidence.filter((e) => e.kind === "quote");
  const findings = evidence.filter((e) => e.kind === "comparison_finding");
  const terms = evidence.filter((e) => e.kind === "terminology");

  const agreements = findings
    .filter((e) => /^(Agreement|Affirmative)/i.test(e.text))
    .slice(0, 4)
    .map((e) => ({ statement: `${e.group}: ${e.text}`, evidenceIds: [e.id] }));
  const disagreements = findings
    .filter((e) => /^(Disagreement|Negative)/i.test(e.text))
    .slice(0, 4)
    .map((e) => ({ statement: `${e.group}: ${e.text}`, evidenceIds: [e.id] }));

  const majorPositions = summaries.slice(0, 5).map((e) => ({
    statement: `${e.group} contributes: ${e.text.slice(0, 160)}`,
    evidenceIds: [e.id],
  }));

  const strongestSupport = [...quotes]
    .sort((a, b) => b.text.length - a.text.length)
    .slice(0, 3)
    .map((e) => ({ position: `From ${e.group}`, evidenceIds: [e.id] }));

  return {
    currentUnderstanding: beliefs.length
      ? `Your current view is anchored by: “${beliefs[0].text.slice(0, 160)}”. The material below has shaped and tested it.`
      : "You are still forming a view on this thread; the material below is what you have encountered so far.",
    majorPositions,
    agreements,
    disagreements,
    terminologyDifferences: terms.slice(0, 3).map((e) => {
      const [term, ...rest] = e.text.split(":");
      return { term: term.trim() || e.text.slice(0, 30), note: rest.join(":").trim() || "usage may differ between sources.", evidenceIds: [e.id] };
    }),
    beliefEvolution: [],
    strongestSupport,
    strongestChallenge: [],
    unresolvedQuestions: [],
    recentChanges: [],
    limitations: [
      "Generated without AI (mock mode): positions are drawn from summaries and prior findings, not fresh reasoning.",
      input.coverageNote,
    ],
    coverageNote: input.coverageNote,
  };
}
