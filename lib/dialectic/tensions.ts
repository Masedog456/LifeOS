/**
 * Deterministic tension detection (LIFEOS-023).
 *
 * Surfaces tensions between the beliefs, concepts, perspectives, evidence and
 * turns already present in a dialogue — using EXPLICIT signals only (graph
 * `contradicts` edges, a concept's declared `opposingConcepts`, competing
 * perspectives the user added, research hypotheses that cite evidence on both
 * sides, and unanswered challenges in the transcript). Nothing is inferred by
 * language modelling; nothing is auto-resolved. Each detected tension carries a
 * stable `signature` so re-running detection never duplicates an existing one.
 *
 * REUSES the LIFEOS-021 knowledge graph and the LIFEOS-022 dialogue context.
 */

import type {
  DialecticEvidenceLink,
  DialogueSession,
  StoreState,
  Tension,
  DialecticTensionKind,
} from "@/types/mvp";
import { buildGraph, lookup, relationshipsOf, type KnowledgeGraph } from "@/lib/graph";
import { anchorIds, buildDialogueContext } from "@/lib/dialogue/context";
import { deriveConfidence } from "@/lib/dialectic/confidence";

/** A detected tension proposal — not yet persisted. Shares Tension's shape sans store fields. */
export type DetectedTension = Omit<Tension, "createdAt" | "updatedAt" | "history">;

function labelOf(state: StoreState, graph: KnowledgeGraph, refId: string): string {
  const n = lookup(graph, refId);
  if (n) return n.label;
  const b = state.beliefs.find((x) => x.id === refId);
  return b ? b.text : refId;
}

function isExperiential(state: StoreState, refId: string): boolean {
  return state.reflections.some((r) => r.id === refId) || state.formationSessions.some((f) => f.id === refId);
}

function isSource(state: StoreState, refId: string): boolean {
  return state.sources.some((s) => s.id === refId);
}

function sig(kind: DialecticTensionKind, ids: string[]): string {
  return `${kind}:${[...ids].filter(Boolean).sort().join("|")}`;
}

const QUESTIONS: Record<DialecticTensionKind, string[]> = {
  conflicting_beliefs: [
    "Which belief rests on stronger evidence, and how would you tell?",
    "Is there a framing under which both are partly right?",
    "What would have to be true for each to be false?",
  ],
  incompatible_assumptions: [
    "Which assumption is load-bearing for each side?",
    "Could both assumptions hold in different scopes?",
  ],
  unresolved_paradox: [
    "Does each side preserve a truth the other discards?",
    "Is the contradiction real, or an artefact of the framing?",
  ],
  competing_values: [
    "Which value takes priority here, and under what conditions?",
    "Can both values be honoured by scoping them to different situations?",
  ],
  empirical_disagreement: [
    "What observation would move you toward one side?",
    "Is the disagreement about the facts, or about their interpretation?",
  ],
  logical_inconsistency: [
    "Where exactly does the reasoning break?",
    "Which premise would you give up to restore consistency?",
  ],
  definition_mismatch: [
    "Are both sides using the key term the same way?",
    "Would a shared definition dissolve the disagreement?",
  ],
};

function build(
  state: StoreState,
  graph: KnowledgeGraph,
  dialogueId: string,
  kind: DialecticTensionKind,
  title: string,
  thesis: string,
  antithesis: string,
  thesisRefs: string[],
  antithesisRefs: string[],
  detail: string,
): DetectedTension {
  const evidence: DialecticEvidenceLink[] = [
    ...thesisRefs.map((refId): DialecticEvidenceLink => ({ id: `${refId}-t`, refId, label: labelOf(state, graph, refId), stance: "supports_thesis" })),
    ...antithesisRefs.map((refId): DialecticEvidenceLink => ({ id: `${refId}-a`, refId, label: labelOf(state, graph, refId), stance: "supports_antithesis" })),
  ];
  const allRefs = [...thesisRefs, ...antithesisRefs];
  const confidence = deriveConfidence({
    sourceCount: new Set(allRefs.filter((r) => isSource(state, r))).size,
    thesisEvidence: thesisRefs.length,
    antithesisEvidence: antithesisRefs.length,
    experientialCount: allRefs.filter((r) => isExperiential(state, r)).length,
    logical: kind === "logical_inconsistency" ? "low" : "unknown",
  });
  return {
    id: "",
    dialogueId,
    kind,
    title,
    thesis,
    antithesis,
    thesisRefs,
    antithesisRefs,
    evidence,
    confidence,
    unresolvedQuestions: QUESTIONS[kind],
    status: "open",
    origin: "detected",
    detail,
    signature: sig(kind, allRefs.length ? allRefs : [title]),
  };
}

export function detectTensions(state: StoreState, session: DialogueSession, graph?: KnowledgeGraph): DetectedTension[] {
  const g = graph ?? buildGraph(state);
  const ctx = buildDialogueContext(state, session, g);
  const anchors = new Set(anchorIds(state, session));
  // The belief/concept universe we consider "in play" for this dialogue.
  const contextBeliefs = new Set<string>([
    ...[...anchors].filter((id) => state.beliefs.some((b) => b.id === id)),
    ...ctx.supportingBeliefs.map((n) => n.id),
    ...ctx.contradictingBeliefs.map((n) => n.id),
  ]);
  const contextConcepts = new Set<string>([
    ...[...anchors].filter((id) => state.concepts.some((c) => c.id === id)),
    ...ctx.relatedConcepts.map((n) => n.id),
  ]);

  const out: DetectedTension[] = [];
  const seen = new Set<string>();
  const push = (t: DetectedTension) => { if (!seen.has(t.signature)) { seen.add(t.signature); out.push(t); } };
  const beliefText = (id: string) => state.beliefs.find((b) => b.id === id)?.text ?? id;

  // A. Contradicting beliefs (conflicting_beliefs) — explicit `contradicts` graph edges.
  for (const bid of contextBeliefs) {
    for (const e of relationshipsOf(g, bid)) {
      if (e.relation !== "contradicts") continue;
      const other = e.from === bid ? e.to : e.from;
      if (!contextBeliefs.has(other) && !state.beliefs.some((b) => b.id === other)) continue;
      if (!state.beliefs.some((b) => b.id === other)) continue;
      push(build(state, g, session.id, "conflicting_beliefs",
        "Two of your beliefs conflict",
        beliefText(bid), beliefText(other), [bid], [other],
        "Connected by an explicit contradicts relationship in your knowledge graph."));
    }
  }

  // B. Opposed concepts (definition_mismatch / unresolved_paradox) — a concept's declared opposites.
  for (const cid of contextConcepts) {
    const c = state.concepts.find((x) => x.id === cid);
    if (!c) continue;
    for (const oid of c.opposingConcepts ?? []) {
      const o = state.concepts.find((x) => x.id === oid);
      if (!o) continue;
      const kind: DialecticTensionKind = (c.aliases?.length || o.aliases?.length) ? "definition_mismatch" : "unresolved_paradox";
      push(build(state, g, session.id, kind,
        kind === "definition_mismatch" ? "The key terms may be defined differently" : "Two concepts each seem to capture a truth",
        `${c.name}${c.definition ? ` — ${c.definition}` : ""}`,
        `${o.name}${o.definition ? ` — ${o.definition}` : ""}`,
        [cid], [oid],
        "These concepts are declared as opposing in your world model."));
    }
  }

  // C. Competing perspectives (competing_values) — ≥2 framework/principle viewpoints the user added.
  const valueParts = session.participants.filter((p) => p.kind === "framework" || p.kind === "principle");
  for (let i = 0; i < valueParts.length; i++) {
    for (let j = i + 1; j < valueParts.length; j++) {
      const a = valueParts[i], b = valueParts[j];
      push(build(state, g, session.id, "competing_values",
        "Two perspectives may pull in different directions",
        a.label, b.label, a.refId ? [a.refId] : [], b.refId ? [b.refId] : [],
        "Both were added as perspectives from your own knowledge; they may prioritise differently."));
    }
  }

  // D. Unanswered challenge (logical_inconsistency) — a challenge/counterargument with no later reply.
  const turns = session.turns;
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    if (t.kind !== "challenge" && t.kind !== "counterargument") continue;
    const answered = turns.slice(i + 1).some((u) => u.kind === "response" || u.kind === "clarification" || u.kind === "summary");
    if (answered) continue;
    // The position being challenged: the most recent prior response/evidence turn, else the topic.
    const prior = [...turns.slice(0, i)].reverse().find((u) => u.kind === "response" || u.kind === "evidence");
    push(build(state, g, session.id, "logical_inconsistency",
      "An open challenge has not been answered",
      prior ? prior.text : (session.topic || session.title),
      t.text,
      [...(prior?.citations ?? [])], [...t.citations],
      "A challenge/counterargument turn in this dialogue has no later response, clarification, or summary."));
  }

  // E. Empirical disagreement (empirical_disagreement) — a research hypothesis cited both for and against.
  for (const n of ctx.relatedResearch) {
    const rp = state.researchProjects.find((r) => r.id === n.id);
    if (!rp) continue;
    for (const h of rp.hypotheses) {
      if (h.supportingEvidence.length && h.contradictingEvidence.length) {
        push(build(state, g, session.id, "empirical_disagreement",
          "Evidence points both ways",
          h.statement,
          "The cited evidence also contradicts this hypothesis.",
          [...h.supportingEvidence], [...h.contradictingEvidence],
          `Hypothesis in research project “${rp.title}” cites evidence on both sides.`));
      }
    }
  }

  return out;
}
