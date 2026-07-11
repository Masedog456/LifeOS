/** Plain-text adapter — the fully-automated baseline. */

import type { IngestionAdapter, TextIngestionRequest } from "@/lib/ingestion/types";

export const textAdapter: IngestionAdapter<TextIngestionRequest> = {
  kind: "text",
  label: "Plain text",
  automated: true,
  async ingest(request) {
    const text = request.text.trim();
    return {
      type: request.sourceType ?? "other",
      input: "text",
      title: request.title?.trim() || text.slice(0, 48) || "Untitled",
      author: request.author?.trim() || undefined,
      text,
      needsText: text.length === 0,
    };
  },
};
