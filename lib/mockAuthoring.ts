/**
 * Deterministic authoring mocks (LIFEOS-019 fallback).
 *
 * Outline and section drafting work fully offline. The mock composes honest
 * prose from the ASSEMBLED evidence and cites the exact records it used — it
 * never invents facts or citations, and it clearly signals mock provenance.
 * Output matches the AI task shapes so it flows through the same validators.
 */

import type { MockEvidence } from "@/lib/mockCompare";

export interface MockOutlineContext {
  kind: string;
  title: string;
  purpose: string;
  audience: string;
}

export function mockOutlines(input: { evidence: MockEvidence[]; context: MockOutlineContext }): unknown {
  const { evidence, context } = input;
  const concepts = evidence.filter((e) => e.group === "Concept").slice(0, 3);
  const sections = [
    { heading: "Introduction", purpose: `Frame “${context.title}” for ${context.audience || "your reader"}.` },
    ...concepts.map((c) => ({ heading: c.text.split(":")[0].slice(0, 40), purpose: `Develop this idea from your evidence.` })),
    { heading: "Conclusion", purpose: "Draw the threads together and state what remains open." },
  ];
  return {
    outlines: [
      {
        title: `${context.title} (thematic)`,
        rationale: "Offline outline (mock): organizes your chosen evidence thematically. Human-selected, not applied.",
        sections,
      },
    ],
  };
}

export interface MockSectionContext {
  heading: string;
  purpose: string;
  transform?: string;
}

export function mockSectionDraft(input: { evidence: MockEvidence[]; context: MockSectionContext }): unknown {
  const { evidence, context } = input;
  const paras: { text: string; citations: string[] }[] = [];

  paras.push({
    text: `This section — “${context.heading}” — ${context.purpose || "develops the argument"}. The following draws only on the evidence you assembled; nothing here is invented.`,
    citations: [],
  });

  for (const e of evidence.slice(0, 6)) {
    paras.push({
      text: `Drawing on your ${e.group.toLowerCase()} “${e.text.slice(0, 90)}”, this paragraph would develop that point in your own words${context.transform ? ` (${context.transform} register)` : ""}.`,
      citations: [e.id],
    });
  }

  if (evidence.length === 0) {
    paras.push({ text: "You have not assembled evidence for this project yet — add sources, beliefs, or concepts, and this section will cite them.", citations: [] });
  }

  return { paragraphs: paras };
}
