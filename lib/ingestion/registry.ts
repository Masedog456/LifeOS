/**
 * Adapter registry. Lists the adapters LifeOS knows about (implemented and
 * planned) so the architecture — not just today's three adapters — is
 * explicit. Adding a future adapter means implementing the interface and
 * registering it here; the pipeline and UI consume it uniformly.
 */

import type { IngestionAdapter, IngestionKind } from "@/lib/ingestion/types";
import { textAdapter } from "@/lib/ingestion/textAdapter";
import { pdfAdapter } from "@/lib/ingestion/pdfAdapter";
import { urlAdapter } from "@/lib/ingestion/urlAdapter";

export const ADAPTERS: Record<IngestionKind, IngestionAdapter> = {
  text: textAdapter as IngestionAdapter,
  pdf: pdfAdapter as IngestionAdapter,
  url: urlAdapter as IngestionAdapter,
};

/** Planned adapters (not yet implemented) — documents the roadmap seam. */
export const PLANNED_ADAPTERS = [
  "epub",
  "kindle",
  "markdown",
  "html",
  "research-paper",
  "image-ocr",
  "audio-transcript",
  "youtube-transcript",
  "podcast-transcript",
  "conversation",
  "email",
  "journal",
] as const;
