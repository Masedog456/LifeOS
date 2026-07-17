/**
 * Reasoning domain facade (LIFEOS-021, Phase 6): reasoning queries. Re-exports
 * the store's public API — no behavior change.
 */

export {
  saveReasoning, updateReasoning, judgeReasoningInsight,
  setReasoningConclusion, setReasoningStatus, attachReasoningToThread, reasoningById,
} from "@/lib/mvpStore";
