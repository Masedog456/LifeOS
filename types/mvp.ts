/**
 * LifeOS MVP adapter types (LIFEOS-002 — Belief Thread MVP).
 *
 * These are intentionally NARROW, localStorage-friendly shapes for the
 * three-screen prototype. They do NOT replace the full domain model in
 * `types/lifeos.ts` — that broader ontology stays intact for later. Each
 * type notes how it maps to the ontology.
 *
 * A localStorage prototype has no relational tables, so `Revision` and
 * `UserJudgment` (separate first-class objects in the ontology) are
 * flattened into arrays embedded on `Belief`. That is a deliberate MVP
 * simplification, not a change to the ontology.
 */

import type { SourceType } from "@/types/lifeos";

export type ISO = string;

/** Maps to ontology `Source`/`Quote`: the raw, immutable thing the user captured. */
export interface Capture {
  id: string;
  /** Verbatim captured text. Immutable once created — never edited in place. */
  text: string;
  createdAt: ISO;
  /** Optional link back to a Knowledge Library source this capture came from. */
  sourceId?: string;
}

/** Maps to ontology `Claim` (status `proposed`): an AI/mock-proposed first-person belief. */
export interface Proposal {
  id: string;
  captureId: string;
  /** Proposed first-person belief statement. */
  claim: string;
  theme?: string;
  /** Character span in the capture text that inspired the claim (best-effort). */
  spanStart?: number;
  spanEnd?: number;
  source: "ai" | "mock";
  createdAt: ISO;
  /** True once the user has made a judgment on it (accept/rewrite/reject/question). */
  resolved: boolean;
}

export type BeliefStatus = "accepted" | "questioned" | "revised" | "rejected";

/** Maps to ontology `Revision`: one point in a belief's wording history (append-only). */
export interface RevisionEntry {
  text: string;
  at: ISO;
  reason: "proposed" | "accepted" | "rewritten" | "reaffirmed" | "questioned";
}

/** Maps to ontology `UserJudgment`: one human verdict on the belief (append-only). */
export interface JudgmentEntry {
  decision: "accepted" | "rewritten" | "rejected" | "questioned" | "reaffirmed";
  at: ISO;
  note?: string;
}

/** Maps to ontology `ConstitutionEntry`: a belief the user currently holds (or has archived). */
export interface Belief {
  id: string;
  captureId: string;
  proposalId: string;
  /** Current wording of the belief — the user's version once rewritten. */
  text: string;
  theme?: string;
  status: BeliefStatus;
  createdAt: ISO;
  updatedAt: ISO;
  /** Append-only wording history — the "thread" the user watches bend over time. */
  revisions: RevisionEntry[];
  /** Append-only judgment history. */
  judgments: JudgmentEntry[];
}

// ---------- Knowledge Library (LIFEOS-003) ----------

/** Reuse the ontology's SourceType (types/lifeos.ts) — no parallel enum. */
export type { SourceType } from "@/types/lifeos";

/** How the source was brought in. Drives which ingestion adapter ran. */
export type SourceInput = "text" | "pdf" | "url";

/** Pipeline progress for a source (see lib/pipeline.ts). */
export type ProcessingState =
  | "captured"
  | "not_started"
  | "queued"
  | "processing"
  | "extracting_text"
  | "chunking"
  | "summarizing"
  | "extracting_quotes"
  | "extracting_concepts"
  | "generating_beliefs"
  | "partial"
  | "ready"
  | "needs_text"
  | "cancelled"
  | "error";

/** User-facing reading status, distinct from pipeline processing state. */
export type SourceStatus = "unread" | "reading" | "read";

/** A chunk of a source's text — the operational unit for long-source analysis. */
export interface KnowledgeChunk {
  id: string;
  index: number;
  text: string;
  /** Char offsets into the normalized source text (present for chunks built ≥ LIFEOS-007). */
  start?: number;
  end?: number;
  /** Optional section/chapter label. */
  label?: string;
}

// ---------- Long-source analysis (LIFEOS-007) ----------

export type ProcessingMode = "quick" | "full" | "stage";
export type Coverage = "sampled" | "full";
export type StageName = "summary" | "quotes" | "concepts" | "beliefs";
export type StageStatus = "not_started" | "processing" | "processed" | "failed" | "cancelled";

/** A map-stage result for a single chunk. Retains chunk provenance. */
export interface ChunkResult {
  chunkId: string;
  index: number;
  summary: string;
  concepts: string[];
  /** Candidate quotes with best-effort offsets within the source. */
  quotes: { text: string; start?: number; end?: number }[];
  claims: string[];
  source: "ai" | "mock";
}

/** Coverage + provenance metadata for the latest analysis run. */
export interface AnalysisMeta {
  mode: ProcessingMode | null;
  coverage: Coverage | null;
  chunksAnalyzed: number;
  totalChunks: number;
  /** Whether derived artifacts came from real AI or the deterministic mock. */
  source: "ai" | "mock" | null;
  /** Count of AI-returned quotes dropped because they didn't match source text. */
  unmatchedQuotes?: number;
  updatedAt?: ISO;
}

export function emptyStages(): Record<StageName, StageStatus> {
  return { summary: "not_started", quotes: "not_started", concepts: "not_started", beliefs: "not_started" };
}

export function emptyAnalysis(): AnalysisMeta {
  return { mode: null, coverage: null, chunksAnalyzed: 0, totalChunks: 0, source: null };
}

/**
 * Maps to ontology `Source` (+ derived `Quote`/`Concept`/`Claim`). The
 * repository entry from which beliefs are eventually formed. Distinct from
 * the Constitution: this is the library, not the worldview.
 */
export interface KnowledgeSource {
  id: string;
  type: SourceType;
  input: SourceInput;
  title: string;
  author?: string;
  /** Provenance of the material: a URL, a filename, or free text. */
  origin?: string;
  addedAt: ISO;
  status: SourceStatus;
  processingState: ProcessingState;
  processingError?: string;
  /** The immutable original text. Never edited in place once set. */
  originalText: string;
  chunks: KnowledgeChunk[];
  summary?: string;
  /** AI/mock-extracted verbatim key quotes (+ any the user saved in the reader). */
  keyQuotes: string[];
  keyConcepts: string[];
  /** Draft first-person belief claims — sent to the Belief Inbox on user action, never auto. */
  candidateBeliefs: string[];
  /** Whether the derived fields above came from real AI or the deterministic mock. */
  derivedSource?: "ai" | "mock";
  // ---- Long-source analysis (LIFEOS-007) ----
  /** Per-chunk map-stage results (provenance for source-wide artifacts). */
  chunkResults?: ChunkResult[];
  /** Independent per-stage status so one failure doesn't erase other results. */
  stages?: Record<StageName, StageStatus>;
  /** Coverage + provenance of the latest analysis run. */
  analysis?: AnalysisMeta;
}

export interface StoreState {
  captures: Capture[];
  proposals: Proposal[];
  beliefs: Belief[];
  sources: KnowledgeSource[];
}
