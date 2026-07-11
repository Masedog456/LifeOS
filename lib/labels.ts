/** Human labels for the library UI. Reuses the ontology's SourceType. */

import type { ProcessingState, SourceType } from "@/types/mvp";

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  book: "Book",
  article: "Article",
  pdf: "PDF",
  webpage: "Web",
  video: "Video",
  podcast: "Podcast",
  conversation: "Conversation",
  journal: "Journal",
  image: "Image",
  other: "Text",
};

/** Types offered when adding a manual-text source (the rest are input-driven). */
export const MANUAL_TEXT_TYPES: SourceType[] = [
  "other",
  "book",
  "article",
  "journal",
  "conversation",
];

export const PROCESSING_LABELS: Record<ProcessingState, string> = {
  captured: "Captured",
  not_started: "Not analyzed",
  queued: "Queued",
  processing: "Analyzing…",
  extracting_text: "Extracting text",
  chunking: "Chunking",
  summarizing: "Summarizing",
  extracting_quotes: "Extracting quotes",
  extracting_concepts: "Extracting concepts",
  generating_beliefs: "Generating beliefs",
  partial: "Partly analyzed",
  ready: "Analyzed",
  needs_text: "Needs text",
  cancelled: "Cancelled",
  error: "Error",
};

const SETTLED: ProcessingState[] = [
  "ready",
  "partial",
  "error",
  "needs_text",
  "cancelled",
  "captured",
  "not_started",
];

export function isProcessing(state: ProcessingState): boolean {
  return !SETTLED.includes(state);
}
