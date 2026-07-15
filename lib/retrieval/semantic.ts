/**
 * Semantic scoring helpers for hybrid retrieval (LIFEOS-015, Phase 5).
 *
 * Live in-browser ranking uses the local lexical embedder (sync, offline,
 * free). Semantic similarity only PROPOSES candidates and boosts ranking — it
 * never establishes truth, contradiction, or influence, and never outranks an
 * exact or concept match. Semantic ranking activates only once the user has
 * built a semantic index (their explicit opt-in).
 */

import type { StoreState } from "@/types/mvp";
import { cosine, localEmbed } from "@/lib/embeddings/local";
import type { EmbeddingVector } from "@/lib/embeddings/types";

/** Minimum cosine for a semantic-only candidate to surface. */
export const SEMANTIC_THRESHOLD = 0.5;

export function queryVector(text: string): EmbeddingVector {
  return localEmbed(text);
}

export function semanticSimilarity(text: string, qVec: EmbeddingVector): number {
  return cosine(localEmbed(text), qVec);
}

/** Semantic ranking is on only after the user has built an index. */
export function hasSemanticIndex(state: StoreState): boolean {
  return state.embeddings.length > 0;
}
