/**
 * Ingestion entry point.
 *
 * `ingest(request)` runs the right adapter, creates the unified
 * KnowledgeSource (immutable original text + provenance), and — when text
 * is available — kicks off the processing pipeline. Returns the new source
 * id for navigation. This is the ONLY thing the UI needs to call; it never
 * knows which adapter ran.
 */

import { addSource } from "@/lib/mvpStore";
import { processSource } from "@/lib/pipeline";
import { textAdapter } from "@/lib/ingestion/textAdapter";
import { pdfAdapter } from "@/lib/ingestion/pdfAdapter";
import { urlAdapter } from "@/lib/ingestion/urlAdapter";
import type { IngestionRequest, IngestionResult } from "@/lib/ingestion/types";

export type { IngestionRequest } from "@/lib/ingestion/types";
export { ADAPTERS, PLANNED_ADAPTERS } from "@/lib/ingestion/registry";

async function runAdapter(request: IngestionRequest): Promise<IngestionResult> {
  // Typed dispatch — the discriminated union narrows each branch.
  switch (request.kind) {
    case "text":
      return textAdapter.ingest(request);
    case "url":
      return urlAdapter.ingest(request);
    case "pdf":
      return pdfAdapter.ingest(request);
  }
}

export async function ingest(request: IngestionRequest): Promise<string> {
  const result = await runAdapter(request);

  const id = addSource({
    type: result.type,
    input: result.input,
    title: result.title,
    author: result.author,
    origin: result.origin,
    originalText: result.text,
    processingState: result.needsText ? "needs_text" : "captured",
    pdfMeta: result.pdfMeta,
    pageMap: result.pageMap,
    extractionStatus: result.extractionStatus,
  });

  if (!result.needsText && result.text.trim()) {
    // Fire-and-forget: the Library/Reader show live processing state.
    void processSource(id, result.text);
  }
  return id;
}
