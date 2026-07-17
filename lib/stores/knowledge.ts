/**
 * Knowledge domain facade (LIFEOS-021, Phase 6): sources, captures, proposals,
 * beliefs, and the Constitution. Re-exports the store's public API for this
 * domain — no behavior change.
 */

export {
  addCapture, attachProposals, judgeProposal, reviseBelief, affirmBelief, questionBelief,
  addSource, getSource, patchSource, setProcessingState, setSourceStatus, setOriginalText,
  saveQuote, sendToInbox,
  captureById, pendingProposals, resurfacedBelief, sourceById, searchSources, beliefsFromSource,
} from "@/lib/mvpStore";
