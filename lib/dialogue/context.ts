/**
 * Dialogue graph integration (LIFEOS-022, Phase 6).
 *
 * REUSES the LIFEOS-021 knowledge graph to surface, for a dialogue's topic and
 * seed records, the related concepts, supporting/contradicting beliefs, related
 * research and authoring, and decision/formation history. Nothing is inferred
 * silently — every item is an EXPLICIT graph neighbour of a seed record (or a
 * concept/belief whose label the topic literally names). Pure and offline.
 */

import type { DialogueSession, StoreState } from "@/types/mvp";
import { buildGraph, relationshipsOf, type GraphNode, type KnowledgeGraph } from "@/lib/graph";

export interface DialogueContext {
  relatedConcepts: GraphNode[];
  supportingBeliefs: GraphNode[];
  contradictingBeliefs: GraphNode[];
  relatedResearch: GraphNode[];
  relatedAuthoring: GraphNode[];
  decisionHistory: GraphNode[];
  formationHistory: GraphNode[];
}

function words(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
}

/** The set of records the dialogue is anchored to: explicit seeds + topic-named concepts/beliefs. */
export function anchorIds(state: StoreState, session: DialogueSession): string[] {
  const ids = new Set<string>(session.seedRefs);
  const tw = words(`${session.topic} ${session.title}`);
  if (tw.size) {
    for (const c of state.concepts) if (words(c.name).size && [...words(c.name)].some((w) => tw.has(w))) ids.add(c.id);
  }
  // Also anchor to perspectives' source records.
  for (const p of session.participants) if (p.refId) ids.add(p.refId);
  return [...ids];
}

export function buildDialogueContext(state: StoreState, session: DialogueSession, graph?: KnowledgeGraph): DialogueContext {
  const g = graph ?? buildGraph(state);
  const anchors = anchorIds(state, session);
  const anchorSet = new Set(anchors);

  const buckets: DialogueContext = {
    relatedConcepts: [], supportingBeliefs: [], contradictingBeliefs: [],
    relatedResearch: [], relatedAuthoring: [], decisionHistory: [], formationHistory: [],
  };
  const seen: Record<keyof DialogueContext, Set<string>> = {
    relatedConcepts: new Set(), supportingBeliefs: new Set(), contradictingBeliefs: new Set(),
    relatedResearch: new Set(), relatedAuthoring: new Set(), decisionHistory: new Set(), formationHistory: new Set(),
  };
  const add = (bucket: keyof DialogueContext, node: GraphNode | undefined) => {
    if (!node || seen[bucket].has(node.id) || anchorSet.has(node.id)) return;
    seen[bucket].add(node.id);
    buckets[bucket].push(node);
  };

  for (const id of anchors) {
    for (const e of relationshipsOf(g, id)) {
      const otherId = e.from === id ? e.to : e.from;
      const other = g.nodes.get(otherId);
      if (!other) continue;
      switch (other.kind) {
        case "concept": add("relatedConcepts", other); break;
        case "belief":
          if (e.relation === "contradicts") add("contradictingBeliefs", other);
          else add("supportingBeliefs", other);
          break;
        case "research_project": add("relatedResearch", other); break;
        case "knowledge_project": add("relatedAuthoring", other); break;
        case "decision": add("decisionHistory", other); break;
        case "formation": add("formationHistory", other); break;
      }
    }
  }

  // Cap each bucket for a calm surface.
  for (const k of Object.keys(buckets) as (keyof DialogueContext)[]) buckets[k] = buckets[k].slice(0, 8);
  return buckets;
}
