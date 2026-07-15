/**
 * Provider-independent embedding seam (LIFEOS-015, Phase 2).
 *
 * The application never couples to a specific vendor. A built-in local
 * lexical embedder is always available (zero-config, offline); a real HTTP
 * provider can be configured server-side. If nothing is configured,
 * deterministic retrieval keeps working fully — semantic is purely additive.
 */

export type EmbeddingVector = number[];

export interface EmbeddingHealth {
  configured: boolean;
  provider: string;
  model: string;
  dimensions: number;
  /** Present only when the provider reports it — never a fabricated estimate. */
  costPer1kTokens?: number;
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dimensions: number;
  health(): EmbeddingHealth;
  embed(text: string): Promise<EmbeddingVector> | EmbeddingVector;
  embedBatch(texts: string[]): Promise<EmbeddingVector[]> | EmbeddingVector[];
}

/** One item queued for embedding, with a content hash for idempotency. */
export interface EmbeddableItem {
  recordId: string;
  type: import("@/types/mvp").EmbeddableType;
  sourceId?: string;
  text: string;
  contentHash: string;
}
