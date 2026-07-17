/**
 * World-model domain facade (LIFEOS-021, Phase 6): concepts, relationships,
 * principles, and frameworks. Re-exports the store's public API — no behavior
 * change.
 */

export {
  createConcept, setConceptFields, setConceptStatus, toggleConceptLink,
  markConceptReviewed, toggleConceptPrinciple, conceptById,
  proposeConceptRelationship, approveConceptRelationship, editConceptRelationship,
  removeConceptRelationship, relationshipById,
  createPrinciple, setPrincipleFields, togglePrincipleBelief, principleById,
  createFramework, setFrameworkFields, toggleFrameworkConcept, toggleFrameworkPrinciple, frameworkById,
} from "@/lib/mvpStore";
