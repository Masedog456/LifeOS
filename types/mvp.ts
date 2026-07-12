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
  /** Page range this chunk spans (PDF sources, LIFEOS-008). */
  pageStart?: number;
  pageEnd?: number;
  /** Optional section/chapter label. */
  label?: string;
}

// ---------- PDF ingestion (LIFEOS-008) ----------

/** Char range of one page within the normalized extracted text. */
export interface PageSpan {
  page: number;
  start: number;
  end: number;
}

export type ExtractionStatus =
  | "text_extracted"
  | "partial_text"
  | "scanned_ocr_required"
  | "extraction_failed";

/** Original PDF metadata (the binary itself is never stored). */
export interface PdfMeta {
  filename: string;
  size: number;
  pageCount: number;
  mime: string;
  uploadedAt: ISO;
  /** Number of pages actually extracted (may be < pageCount if capped). */
  extractedPages: number;
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
  // ---- PDF ingestion (LIFEOS-008) ----
  pdfMeta?: PdfMeta;
  /** Page → char-range map into the (immutable) extracted text. */
  pageMap?: PageSpan[];
  extractionStatus?: ExtractionStatus;
}

// ---------- Retrieval (LIFEOS-009) ----------

export type RecordType =
  | "source"
  | "chunk"
  | "summary"
  | "concept"
  | "quote"
  | "capture"
  | "proposal"
  | "belief"
  | "revision";

/** A normalized, searchable view over existing data — built in memory, not persisted. */
export interface RetrievalRecord {
  id: string;
  type: RecordType;
  text: string;
  title?: string;
  sourceId?: string;
  captureId?: string;
  beliefId?: string;
  page?: number;
  status?: string;
  concepts?: string[];
  createdAt?: ISO;
  updatedAt?: ISO;
  href?: string;
}

export type FeedbackVerdict = "relevant" | "not_relevant" | "dismissed" | "snoozed";

/** User feedback on a surfaced retrieval record — tunes future deterministic ranking. */
export interface FeedbackEntry {
  recordId: string;
  verdict: FeedbackVerdict;
  at: ISO;
  /** Set when verdict is "snoozed": hidden until this time. */
  snoozeUntil?: ISO;
}

// ---------- Comparative intelligence (LIFEOS-010) ----------

/** What kind of material was selected into a comparison. */
export type ComparisonInputKind = "source" | "belief" | "passage";

/** A single selected material in a comparison, with enough to rebuild evidence. */
export interface ComparisonInputRef {
  kind: ComparisonInputKind;
  /** Display label (source title / belief snippet / passage preview). */
  label: string;
  sourceId?: string;
  beliefId?: string;
  /** For passage inputs: the exact selected quote + provenance. */
  quote?: string;
  page?: number;
}

export type EvidenceKind =
  | "metadata"
  | "summary"
  | "chunk_summary"
  | "quote"
  | "concept"
  | "claim"
  | "belief"
  // ---- dialectical inquiry (LIFEOS-011) ----
  | "revision"
  | "comparison_finding"
  | "terminology";

/**
 * One deterministic, provenance-bearing evidence item. Built from existing
 * data (never fabricated) and referenced by id from the comparison result.
 */
export interface EvidenceItem {
  /** Stable packet id, e.g. "E1". */
  id: string;
  kind: EvidenceKind;
  /** Which selected material this belongs to (label). */
  group: string;
  sourceId?: string;
  beliefId?: string;
  chunkId?: string;
  page?: number;
  start?: number;
  end?: number;
  /** Exact text (verbatim for quotes). */
  text: string;
  /** Whether the underlying artifact came from real AI or the mock. */
  origin?: "ai" | "mock";
}

/** Evidence grouped per selected material, with coverage honesty. */
export interface EvidenceGroup {
  /** A comparison input, or (LIFEOS-011) a dialectical-inquiry input. */
  ref: ComparisonInputRef | InquiryInputRef;
  coverage: Coverage | null;
  /** True when only part of the source was analyzed/extracted. */
  partial: boolean;
  items: EvidenceItem[];
}

/** A synthesized point that MUST cite evidence ids. */
export interface ComparisonPoint {
  statement: string;
  evidenceIds: string[];
}

/** Same term used differently, or different terms with similar function. */
export interface TerminologyDifference {
  term: string;
  note: string;
  evidenceIds: string[];
}

export type ContradictionKind =
  | "logical"
  | "practical"
  | "definitional"
  | "level_of_analysis"
  | "historical"
  | "ambiguity";

export interface Disagreement extends ComparisonPoint {
  /** Not every difference is a contradiction — classify it. */
  kind: ContradictionKind;
}

export interface PositionEvidence {
  position: string;
  evidenceIds: string[];
}

/** Strict structured comparison result (Phase 4). */
export interface ComparisonResultData {
  title: string;
  question: string;
  sourcesCompared: string[];
  sharedConcepts: string[];
  agreements: ComparisonPoint[];
  disagreements: Disagreement[];
  terminologyDifferences: TerminologyDifference[];
  assumptions: ComparisonPoint[];
  strongestEvidence: PositionEvidence[];
  unresolvedTensions: ComparisonPoint[];
  questionsForUser: string[];
  relationToBeliefs: ComparisonPoint[];
  limitations: string[];
  coverageNote: string;
  /** Points dropped in verification for citing missing/invalid evidence. */
  flagged?: string[];
}

export type ComparisonDecision = "accepted" | "rewritten" | "questioned" | "rejected";

/** A human verdict on one comparison insight (append-only). */
export interface ComparisonJudgment {
  /** Which insight, e.g. "agreement:0" or "disagreement:2". */
  insightRef: string;
  decision: ComparisonDecision;
  at: ISO;
  note?: string;
}

/** A saved comparison — a PROPOSAL, never an automatic conclusion. */
export interface Comparison {
  id: string;
  title: string;
  question: string;
  inputs: ComparisonInputRef[];
  sourceIds: string[];
  beliefIds: string[];
  /** Flat evidence packet the result references by id. */
  evidence: EvidenceItem[];
  result: ComparisonResultData;
  /** Model label ("mock" or the configured model). */
  aiModel: string;
  source: "ai" | "mock";
  coverage: Coverage | null;
  partial: boolean;
  /** Whether a second verification pass ran. */
  verified: boolean;
  createdAt: ISO;
  /** Append-only human judgments on the insights. */
  judgments: ComparisonJudgment[];
}

// ---------- Dialectical intelligence (LIFEOS-011) ----------

export type InquiryInputKind = "source" | "belief" | "passage" | "comparison";

export interface InquiryInputRef {
  kind: InquiryInputKind;
  label: string;
  sourceId?: string;
  beliefId?: string;
  comparisonId?: string;
  quote?: string;
  page?: number;
}

/** Argument taxonomy (Phase 5) — not every disagreement is a contradiction. */
export type ArgumentType =
  | "premise"
  | "conclusion"
  | "objection"
  | "rebuttal"
  | "qualification"
  | "analogy"
  | "definition"
  | "empirical"
  | "interpretive"
  | "theological"
  | "personal_judgment";

/** Reasoning defects the dialectic may name (Phase 5) — cautiously. */
export type FallacyType =
  | "invalid_inference"
  | "hidden_assumption"
  | "equivocation"
  | "circular_reasoning"
  | "unsupported_generalization";

/** A grounded dialectical assertion — MUST cite evidence. */
export interface DialecticPoint {
  statement: string;
  evidenceIds: string[];
  /** Optional argument-type tag. */
  argType?: ArgumentType;
}

export interface DialecticDefinition {
  term: string;
  definition: string;
}

export interface ReasoningIssue {
  kind: FallacyType;
  note: string;
  evidenceIds: string[];
}

/** Strict structured dialectic (Phase 4). Substantive assertions cite evidence. */
export interface DialecticResultData {
  question: string;
  definitions: DialecticDefinition[];
  assumptions: DialecticPoint[];
  affirmativeCase: DialecticPoint[];
  negativeCase: DialecticPoint[];
  supportingEvidence: PositionEvidence[];
  counterarguments: DialecticPoint[];
  rebuttals: DialecticPoint[];
  terminologyDisputes: TerminologyDifference[];
  distinctions: string[];
  unresolvedAmbiguities: string[];
  possibleSyntheses: DialecticPoint[];
  evidenceThatWouldChange: string[];
  questionsForHuman: string[];
  relationToBeliefs: DialecticPoint[];
  reasoningIssues: ReasoningIssue[];
  limitations: string[];
  coverageNote: string;
  /** Assertions dropped in verification for citing missing/invalid evidence. */
  flagged?: string[];
}

export type InquiryStatus = "open" | "provisional" | "unresolved" | "resolved";

/** One append-only prior state of an inquiry (never overwritten). */
export interface InquiryRevision {
  at: ISO;
  result: DialecticResultData;
  source: "ai" | "mock";
  /** Labels of materials newly added at this step. */
  addedInputs?: string[];
  note?: string;
}

/** A saved dialectical inquiry — a reasoning aid, never an automatic verdict. */
export interface Inquiry {
  id: string;
  question: string;
  inputs: InquiryInputRef[];
  sourceIds: string[];
  beliefIds: string[];
  comparisonIds: string[];
  evidence: EvidenceItem[];
  /** Latest structured dialectic. */
  result: DialecticResultData;
  /** Append-only history of prior results (older first). */
  history: InquiryRevision[];
  aiModel: string;
  source: "ai" | "mock";
  coverage: Coverage | null;
  partial: boolean;
  verified: boolean;
  status: InquiryStatus;
  /** The user's own provisional conclusion, if written. */
  provisionalConclusion?: string;
  /** Append-only human judgments on the insights. */
  judgments: ComparisonJudgment[];
  createdAt: ISO;
  updatedAt: ISO;
}

// ---------- Megathreads & longitudinal knowledge (LIFEOS-012) ----------

export type MegathreadStatus = "active" | "dormant" | "archived";

export type MegathreadSeedType =
  | "concept"
  | "belief"
  | "question"
  | "source"
  | "comparison"
  | "inquiry"
  | "manual";

export type ThreadMemberType =
  | "source"
  | "capture"
  | "belief"
  | "proposal"
  | "comparison"
  | "inquiry";

/** A member points to an existing record — no source text is duplicated. */
export interface ThreadMemberRef {
  type: ThreadMemberType;
  id: string;
  /** Whether the item was auto-suggested (deterministically) or user-added. */
  addedBy: "auto" | "user";
  /** Explainable reason it was associated (deterministic). */
  reason?: string;
  at?: ISO;
}

export type TimelineItemType =
  | "capture"
  | "source_added"
  | "quote"
  | "proposal"
  | "judgment"
  | "revision"
  | "comparison"
  | "inquiry"
  | "provisional_conclusion"
  | "belief_status";

/** A derived, read-only timeline event (built from existing records, never stored). */
export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  at: ISO;
  title: string;
  detail?: string;
  origin?: "human" | "ai" | "mock";
  sourceId?: string;
  beliefId?: string;
  page?: number;
  href?: string;
  /** Relationship to the thread seed / why it belongs. */
  relation?: string;
}

/** Cautious thread synthesis (Phase 5). Substantive points cite evidence ids. */
export interface ThreadSynthesisData {
  currentUnderstanding: string;
  majorPositions: DialecticPoint[];
  agreements: ComparisonPoint[];
  disagreements: ComparisonPoint[];
  terminologyDifferences: TerminologyDifference[];
  beliefEvolution: string[];
  strongestSupport: PositionEvidence[];
  strongestChallenge: PositionEvidence[];
  unresolvedQuestions: string[];
  recentChanges: string[];
  limitations: string[];
  coverageNote: string;
  flagged?: string[];
}

export interface ThreadQuestion {
  text: string;
  resolved: boolean;
}

/** A living, provenance-grounded timeline of understanding (not a folder). */
export interface Megathread {
  id: string;
  title: string;
  description?: string;
  status: MegathreadStatus;
  seedType: MegathreadSeedType;
  seedId?: string;
  seedLabel?: string;
  /** Explicit member references (auto-suggested + user-added). */
  members: ThreadMemberRef[];
  /** Member ids featured/pinned (also drives featured order). */
  pinned: string[];
  /** Record ids the user explicitly excluded (never re-suggested). */
  excluded: string[];
  synthesis?: ThreadSynthesisData;
  synthesisSource?: "ai" | "mock" | "user";
  /** The evidence packet the current synthesis cites. */
  synthesisEvidence?: EvidenceItem[];
  unresolvedQuestions: ThreadQuestion[];
  notes?: string;
  /** Append-only human judgments on synthesis insights. */
  judgments: ComparisonJudgment[];
  /** Append-only change log (never rewritten). */
  revisions: { at: ISO; note: string }[];
  createdAt: ISO;
  updatedAt: ISO;
}

export interface StoreState {
  captures: Capture[];
  proposals: Proposal[];
  beliefs: Belief[];
  sources: KnowledgeSource[];
  feedback: FeedbackEntry[];
  comparisons: Comparison[];
  inquiries: Inquiry[];
  megathreads: Megathread[];
}
