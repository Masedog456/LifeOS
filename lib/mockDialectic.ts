/**
 * Deterministic mock dialectic (LIFEOS-011, Phase 6 fallback).
 *
 * Produces a real, evidence-cited dialectic from the packet alone — no AI.
 * It deliberately AVOIDS fabricating a fake-symmetric counter-position: the
 * affirmative case is drawn from evidence sharing wording with the question,
 * and the negative case is an HONEST skeptical placeholder (clearly labelled)
 * rather than invented opposing claims. Output matches the shape the AI
 * "dialectic" task returns, so it flows through the same validator.
 */

import type { MockEvidence } from "@/lib/mockCompare";

interface MockInput {
  evidence: MockEvidence[];
  question: string;
  coverageNote: string;
}

const STOP = new Set([
  "the", "and", "for", "are", "but", "not", "you", "that", "this", "with", "from",
  "have", "what", "does", "your", "they", "them", "into", "when", "will", "would",
  "there", "their", "about", "which", "were", "been", "some", "such", "is", "of", "a",
  "to", "in", "on", "or", "an", "be", "it", "as", "do",
]);

function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t));
}

export function mockDialectic(input: MockInput): unknown {
  const { evidence, question } = input;
  const qTokens = new Set(tokens(question));

  const quotes = evidence.filter((e) => e.kind === "quote");
  const concepts = evidence.filter((e) => e.kind === "concept");
  const claims = evidence.filter((e) => e.kind === "claim");
  const beliefs = evidence.filter((e) => e.kind === "belief");
  const revisions = evidence.filter((e) => e.kind === "revision");
  const meta = evidence.filter((e) => e.kind === "metadata" || e.kind === "belief");

  const relevant = (e: MockEvidence) => tokens(e.text).some((t) => qTokens.has(t));

  // Affirmative: evidence whose wording overlaps the question (a supporting
  // reading), else the first couple of quotes as a cautious fallback.
  let affirmSrc = quotes.filter(relevant);
  if (affirmSrc.length === 0) affirmSrc = quotes.slice(0, 2);
  const affirmativeCase = affirmSrc.slice(0, 3).map((e) => ({
    statement: `A supporting reading: ${e.group} can be taken to favour an affirmative answer — “${e.text.slice(0, 140)}”.`,
    evidenceIds: [e.id],
    argType: "interpretive",
  }));

  // Negative: HONEST placeholder — the mock cannot detect a genuine
  // counter-position, so it says so rather than inventing one.
  const negativeCase = meta.slice(0, 2).map((e) => ({
    statement: `(mock) No explicit counter-evidence was detected deterministically in ${e.group}; a careful reading may find the material qualifies or resists an affirmative answer.`,
    evidenceIds: [e.id],
    argType: "qualification",
  }));

  const supportingEvidence = affirmSrc.slice(0, 3).map((e) => ({
    position: `Affirmative — from ${e.group}`,
    evidenceIds: [e.id],
  }));

  const assumptions = claims.slice(0, 3).map((e) => ({
    statement: `${e.group} appears to assume: ${e.text}`,
    evidenceIds: [e.id],
    argType: "premise",
  }));

  const counterEvidence = quotes.filter((e) => !relevant(e)).slice(0, 2);
  const counterarguments = counterEvidence.map((e) => ({
    statement: `A reader could object using ${e.group}: “${e.text.slice(0, 140)}” may not bear on the question as directly as it seems.`,
    evidenceIds: [e.id],
    argType: "objection",
  }));
  const rebuttals = counterEvidence.map((e) => ({
    statement: `That objection can be qualified: the passage remains the primary evidence and should be read in context, not dismissed.`,
    evidenceIds: [e.id],
    argType: "rebuttal",
  }));

  const relationToBeliefs = [...beliefs, ...revisions].slice(0, 3).map((e) => ({
    statement: `Your ${e.kind === "revision" ? "earlier wording" : "current belief"} “${e.text.slice(0, 120)}” bears on this question; consider whether the evidence supports, complicates, or refines it.`,
    evidenceIds: [e.id],
    argType: "personal_judgment",
  }));

  return {
    question: input.question,
    definitions: concepts.slice(0, 2).map((e) => ({
      term: e.text,
      definition: `A key term appearing in ${e.group}; its precise meaning may vary between sources and should be pinned down before drawing conclusions.`,
    })),
    assumptions,
    affirmativeCase,
    negativeCase,
    supportingEvidence,
    counterarguments,
    rebuttals,
    terminologyDisputes: concepts.slice(0, 2).map((e) => ({
      term: e.text,
      note: `Confirm each source means the same thing by “${e.text}”; the term may parallel rather than match exactly.`,
      evidenceIds: [e.id],
    })),
    distinctions: [
      "Distinguish what a source explicitly states from how later interpreters read it.",
      "Distinguish a descriptive claim about the text from a normative claim about what is true.",
    ],
    unresolvedAmbiguities: [
      "Whether the key language is meant literally or symbolically is not settled by the evidence alone.",
    ],
    possibleSyntheses: [
      { statement: "Both the affirmative and skeptical readings may hold at different levels of analysis.", evidenceIds: [] },
    ],
    evidenceThatWouldChange: [
      "An explicit statement in a source directly addressing the question would shift the balance.",
      "A source that clearly contradicts the affirmative reading would strengthen the negative case.",
    ],
    questionsForHuman: [
      "Which reading do you find more faithful to the sources, and why?",
      "Is there a distinction here you want to record as a belief?",
      "What would you need to see to change your mind?",
    ],
    relationToBeliefs,
    reasoningIssues: [],
    limitations: [
      "Generated without AI (mock mode): the affirmative case is drawn from wording overlap and the negative case is a placeholder — this is not genuine argument evaluation.",
      input.coverageNote,
    ],
    coverageNote: input.coverageNote,
  };
}
