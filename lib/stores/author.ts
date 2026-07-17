/**
 * Authoring domain facade (LIFEOS-021, Phase 6): knowledge projects, outlines,
 * and sections. Re-exports the store's public API — no behavior change.
 */

export {
  createKnowledgeProject, setProjectFields, toggleProjectEvidence,
  setProjectOutlines, chooseProjectOutline,
  addProjectSection, setSectionHeading, removeProjectSection,
  setSectionDraft, editSectionParagraph, removeSectionParagraph,
  markProjectReviewed, knowledgeProjectById,
} from "@/lib/mvpStore";
