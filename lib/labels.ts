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
  extracting_text: "Extracting text",
  chunking: "Chunking",
  summarizing: "Summarizing",
  extracting_quotes: "Extracting quotes",
  extracting_concepts: "Extracting concepts",
  generating_beliefs: "Generating beliefs",
  ready: "Ready",
  needs_text: "Needs text",
  error: "Error",
};

export function isProcessing(state: ProcessingState): boolean {
  return (
    state !== "ready" && state !== "error" && state !== "needs_text" && state !== "captured"
  );
}
