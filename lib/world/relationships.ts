/**
 * Concept relationship metadata (LIFEOS-018, Phase 3).
 *
 * The 12 supported relationship types, their human labels, and the mapping
 * from a relationship type onto the two concepts' denormalized structural
 * arrays. Approving a relationship is the ONLY way a concept↔concept edge
 * enters the graph — nothing is inferred silently. Pure and deterministic.
 */

import type { Concept, ConceptRelationship, ConceptRelationshipType, StoreState } from "@/types/mvp";

export const RELATIONSHIP_TYPES: ConceptRelationshipType[] = [
  "supports",
  "depends_on",
  "contradicts",
  "extends",
  "refines",
  "contains",
  "requires",
  "explains",
  "analogous_to",
  "historically_related",
  "terminologically_related",
  "part_of",
];

export const RELATIONSHIP_LABEL: Record<ConceptRelationshipType, string> = {
  supports: "supports",
  depends_on: "depends on",
  contradicts: "contradicts",
  extends: "extends",
  refines: "refines",
  contains: "contains",
  requires: "requires",
  explains: "explains",
  analogous_to: "is analogous to",
  historically_related: "is historically related to",
  terminologically_related: "is terminologically related to",
  part_of: "is part of",
};

/** Which structural slot the relationship type maps onto (from the FROM concept's view). */
export type StructuralSlot = "parent" | "child" | "related" | "opposing";

/**
 * Map a relationship type to how it shapes the two concepts' structural arrays.
 * `from` gets the `fromSlot`; `to` gets the mirror. `contains`: from is the
 * parent of to. `part_of`: from is a child of to. `contradicts`: mutual
 * opposition. Everything else: mutual "related".
 */
export function structuralMapping(type: ConceptRelationshipType): { fromSlot: StructuralSlot; toSlot: StructuralSlot } {
  switch (type) {
    case "contains":
      return { fromSlot: "child", toSlot: "parent" }; // from contains to ⇒ to is a child of from
    case "part_of":
      return { fromSlot: "parent", toSlot: "child" }; // from is part_of to ⇒ to is a parent of from
    case "contradicts":
      return { fromSlot: "opposing", toSlot: "opposing" };
    default:
      return { fromSlot: "related", toSlot: "related" };
  }
}

const SLOT_FIELD: Record<StructuralSlot, keyof Pick<Concept, "parentConcepts" | "childConcepts" | "relatedConcepts" | "opposingConcepts">> = {
  parent: "parentConcepts",
  child: "childConcepts",
  related: "relatedConcepts",
  opposing: "opposingConcepts",
};

/** The concept field a slot writes to (e.g. "parent" → "parentConcepts"). */
export function slotField(slot: StructuralSlot) {
  return SLOT_FIELD[slot];
}

/** Approved relationships touching a concept (either direction). */
export function relationshipsFor(state: StoreState, conceptId: string): ConceptRelationship[] {
  return state.conceptRelationships.filter((r) => r.fromConceptId === conceptId || r.toConceptId === conceptId);
}

/** Proposed (unapproved) relationships awaiting human review, newest first. */
export function proposedRelationships(state: StoreState): ConceptRelationship[] {
  return state.conceptRelationships
    .filter((r) => !r.approved)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
