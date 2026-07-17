/**
 * Decision domain facade (LIFEOS-021, Phase 6): decision records. Re-exports
 * the store's public API — no behavior change.
 */

export {
  createDecision, setDecisionFields, setDecisionStatus,
  upsertDecisionOption, removeDecisionOption, upsertDecisionCriterion, removeDecisionCriterion,
  setDecisionRating, setDecisionAnalysis, setProvisionalChoice, setFinalChoice,
  reopenDecision, addOutcomeReview, judgeDecisionInsight, attachDecisionToThread, decisionById,
} from "@/lib/mvpStore";
