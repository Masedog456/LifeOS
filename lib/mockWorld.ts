/**
 * Deterministic mock world-model proposals (LIFEOS-018 fallback).
 *
 * Proposes concepts, links, duplicates, and principles from the packet with
 * NO AI — honest, cited, and clearly labeled. Output matches the AI
 * "concept_extract" shape so it flows through the same validator. Never
 * fabricates: every proposal points at real records in the packet.
 */

import type { MockEvidence } from "@/lib/mockCompare";

export function mockWorld(input: { evidence: MockEvidence[] }): unknown {
  const { evidence } = input;
  const concepts = evidence.filter((e) => e.group === "Concept");
  const beliefs = evidence.filter((e) => e.group === "Belief");
  const sources = evidence.filter((e) => e.group === "Source");
  const proposals: unknown[] = [];

  // Missing definitions among modeled concepts.
  for (const c of concepts.filter((e) => /\(no definition\)/.test(e.text)).slice(0, 4)) {
    proposals.push({
      kind: "missing_definition",
      statement: `“${c.text.replace(/ \(no definition\)$/, "")}” has no definition — write one grounded in your sources.`,
      concepts: [c.id],
      citations: [c.id],
    });
  }

  // Possible links: a belief that mentions a concept's name.
  for (const c of concepts.slice(0, 6)) {
    const name = c.text.split(":")[0].trim().toLowerCase();
    const b = beliefs.find((e) => e.text.toLowerCase().includes(name));
    if (b) {
      proposals.push({
        kind: "missing_link",
        statement: `A belief may relate to the concept “${c.text.split(":")[0].trim()}” — review and pick the relationship.`,
        concepts: [c.id],
        relationshipType: "supports",
        citations: [c.id, b.id],
      });
    }
  }

  // Possible principle from a recurring belief.
  if (beliefs[0]) {
    proposals.push({
      kind: "possible_principle",
      statement: "A belief here may express a reusable principle — consider naming it.",
      concepts: [],
      suggestion: beliefs[0].text.slice(0, 100),
      citations: [beliefs[0].id],
    });
  }

  // Worldview cluster from sources sharing concepts (surface only, never auto-group).
  if (sources.length >= 2) {
    proposals.push({
      kind: "worldview_cluster",
      statement: "Several sources share concepts — they may belong to one framework you could name.",
      concepts: [],
      citations: sources.slice(0, 3).map((s) => s.id),
    });
  }

  return { proposals };
}
