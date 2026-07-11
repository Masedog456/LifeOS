/**
 * Ingestion architecture (LIFEOS-006).
 *
 * Every source — whatever its origin — becomes the SAME internal object: a
 * KnowledgeSource with immutable `originalText` plus provenance. An
 * IngestionAdapter's only job is to turn one kind of raw material into an
 * IngestionResult (extracted text + metadata + provenance). Adding a new
 * source kind = adding one adapter; nothing else in the system changes.
 *
 * Implemented adapters: text, pdf, url. The interface is designed so future
 * adapters (epub, markdown, html, image/OCR, audio/YouTube/podcast
 * transcripts, email, conversation, journal, research paper) slot in the
 * same way — see INGESTION.md.
 */

import type { SourceInput, SourceType } from "@/types/mvp";

export type IngestionKind = "text" | "pdf" | "url";

export interface TextIngestionRequest {
  kind: "text";
  text: string;
  title?: string;
  author?: string;
  sourceType?: SourceType;
}

export interface PdfIngestionRequest {
  kind: "pdf";
  file: File;
  title?: string;
  author?: string;
}

export interface UrlIngestionRequest {
  kind: "url";
  url: string;
  title?: string;
}

export type IngestionRequest =
  | TextIngestionRequest
  | PdfIngestionRequest
  | UrlIngestionRequest;

/**
 * The normalized output of an adapter. `needsText: true` means extraction
 * couldn't produce the body automatically (a clean, honest fallback): the
 * source is created with provenance and the user supplies its text in the
 * reader. This is the seam a real extractor later fills without touching
 * the rest of the pipeline.
 */
export interface IngestionResult {
  type: SourceType;
  input: SourceInput;
  title: string;
  author?: string;
  /** Provenance: URL, filename, or free text. */
  origin?: string;
  /** Extracted, normalized body text ("" when needsText). */
  text: string;
  needsText: boolean;
  /** Human-facing note explaining a fallback, shown in the reader. */
  note?: string;
}

export interface IngestionAdapter<R extends IngestionRequest = IngestionRequest> {
  kind: IngestionKind;
  label: string;
  /** True when this adapter can automatically produce text (vs. seam/fallback). */
  automated: boolean;
  ingest(request: R): Promise<IngestionResult>;
}
