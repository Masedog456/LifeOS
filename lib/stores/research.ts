/**
 * Research domain facade (LIFEOS-021, Phase 6): research projects, questions,
 * hypotheses, and argument maps. Re-exports the store's public API — no
 * behavior change.
 */

export {
  createResearchProject, setResearchFields,
  addResearchItem, editResearchItem, toggleResearchItemResolved, removeResearchItem,
  addResearchDefinition, removeResearchDefinition, addResearchNote, removeResearchNote,
  toggleResearchEvidence,
  addHypothesis, setHypothesisFields, toggleHypothesisEvidence, setHypothesisOpenQuestions, removeHypothesis,
  addArgumentNode, removeArgumentNode, addArgumentEdge, removeArgumentEdge,
  markResearchReviewed, seedAuthorFromResearch, researchProjectById,
} from "@/lib/mvpStore";
