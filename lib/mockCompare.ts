/**
 * Deterministic mock comparison (LIFEOS-010, Phase 5 fallback).
 *
 * Produces a REAL, provenance-bearing comparison from the evidence packet
 * alone — no AI. Agreements/disagreements cite actual evidence ids, shared
 * concepts are computed by intersection, and terminology overlaps are
 * surfaced cautiously (never declared identical). Output matches the shape
 * the AI "compare" task returns, so it flows through the same validator.
 */

/** Structural evidence shape both EvidenceItem and the route's wire type satisfy. */
export interface MockEvidence {
  id: string;
  group: string;
  kind: string;
  text: string;
  page?: number;
}

interface MockInput {
  evidence: MockEvidence[];
  question: string;
  title: string;
  sourcesCompared: string[];
  coverageNote: string;
}

function byGroup(evidence: MockEvidence[]): Map<string, MockEvidence[]> {
  const m = new Map<string, MockEvidence[]>();
  for (const e of evidence) {
    const arr = m.get(e.group) ?? [];
    arr.push(e);
    m.set(e.group, arr);
  }
  return m;
}

export function mockCompare(input: MockInput): unknown {
  const { evidence } = input;
  const groups = byGroup(evidence);
  const labels = [...groups.keys()];

  // Concept id lookup: normalized concept text -> [{group, id, text}]
  const conceptHits = new Map<string, { group: string; id: string; text: string }[]>();
  for (const e of evidence) {
    if (e.kind !== "concept") continue;
    const key = e.text.toLowerCase().trim();
    const arr = conceptHits.get(key) ?? [];
    arr.push({ group: e.group, id: e.id, text: e.text });
    conceptHits.set(key, arr);
  }

  const shared = [...conceptHits.entries()].filter(
    ([, hits]) => new Set(hits.map((h) => h.group)).size >= 2,
  );

  const agreements = shared.slice(0, 5).map(([, hits]) => ({
    statement: `Both ${hits.map((h) => h.group).filter((v, i, a) => a.indexOf(v) === i).join(" and ")} engage the concept "${hits[0].text}", which may indicate common ground.`,
    evidenceIds: hits.map((h) => h.id),
  }));

  // Concepts unique to a single group → a definitional/level-of-analysis difference.
  const unique = [...conceptHits.entries()].filter(
    ([, hits]) => new Set(hits.map((h) => h.group)).size === 1,
  );
  const disagreements = unique.slice(0, 4).map(([, hits]) => ({
    statement: `"${hits[0].text}" appears in ${hits[0].group} but is not surfaced in the other material; the sources may differ in emphasis here.`,
    kind: "definitional",
    evidenceIds: [hits[0].id],
  }));

  // Terminology: shared terms flagged cautiously (never "identical").
  const terminologyDifferences = shared.slice(0, 3).map(([, hits]) => ({
    term: hits[0].text,
    note: `Each source uses "${hits[0].text}"; under their differing framings this term may parallel rather than match exactly. Read in context before treating as equivalent.`,
    evidenceIds: hits.map((h) => h.id),
  }));

  // Assumptions from candidate claims.
  const assumptions = labels
    .map((label) => {
      const claim = (groups.get(label) ?? []).find((e) => e.kind === "claim");
      return claim
        ? { statement: `${label} appears to assume: ${claim.text}`, evidenceIds: [claim.id] }
        : null;
    })
    .filter((x): x is { statement: string; evidenceIds: string[] } => x !== null)
    .slice(0, 4);

  // Strongest evidence: the longest quote per group.
  const strongestEvidence = labels
    .map((label) => {
      const quotes = (groups.get(label) ?? []).filter((e) => e.kind === "quote");
      const longest = quotes.sort((a, b) => b.text.length - a.text.length)[0];
      return longest
        ? { position: `Representative of ${label}`, evidenceIds: [longest.id] }
        : null;
    })
    .filter((x): x is { position: string; evidenceIds: string[] } => x !== null);

  // Unresolved tensions cite the metadata ids of the compared materials.
  const metaIds = labels
    .map((label) => (groups.get(label) ?? []).find((e) => e.kind === "metadata" || e.kind === "belief")?.id)
    .filter((x): x is string => Boolean(x));
  const unresolvedTensions =
    metaIds.length >= 2
      ? [
          {
            statement:
              "Whether these positions ultimately agree cannot be settled deterministically — a real reading (or AI analysis) is needed to weigh the differences.",
            evidenceIds: metaIds.slice(0, 4),
          },
        ]
      : [];

  // Relation to beliefs (belief inputs).
  const beliefItems = evidence.filter((e) => e.kind === "belief");
  const relationToBeliefs = beliefItems.map((b) => {
    const conceptId = shared[0]?.[1]?.[0]?.id;
    return {
      statement: `Your belief "${b.text.slice(0, 120)}" touches themes present in the compared sources; consider whether they support, complicate, or refine it.`,
      evidenceIds: conceptId ? [b.id, conceptId] : [b.id],
    };
  });

  return {
    title: input.title,
    question: input.question,
    sourcesCompared: input.sourcesCompared,
    sharedConcepts: shared.map(([, hits]) => hits[0].text).slice(0, 12),
    agreements,
    disagreements,
    terminologyDifferences,
    assumptions,
    strongestEvidence,
    unresolvedTensions,
    questionsForUser: [
      "Which of these sources feels most persuasive to you, and why?",
      "Do any apparent agreements dissolve once you consider each source's assumptions?",
      "Is there a distinction here you want to record as a belief?",
    ],
    relationToBeliefs,
    limitations: [
      "Generated without AI (mock mode): agreements/disagreements are derived from concept overlap, not genuine semantic understanding.",
      input.coverageNote,
    ],
    coverageNote: input.coverageNote,
  };
}
