/**
 * URL article adapter — automated, dependency-free.
 *
 * Delegates extraction to the server route `/api/extract` (mode "url"),
 * which fetches the page and reduces its HTML to readable text without any
 * heavy/fragile dependency. If the fetch fails, the page is JS-rendered, or
 * the body is too thin, it degrades cleanly to the "paste the text"
 * fallback — never a hard error.
 */

import type { IngestionAdapter, UrlIngestionRequest } from "@/lib/ingestion/types";

export const urlAdapter: IngestionAdapter<UrlIngestionRequest> = {
  kind: "url",
  label: "Web article",
  automated: true,
  async ingest(request) {
    const url = request.url.trim();
    const fallback = {
      type: "webpage" as const,
      input: "url" as const,
      title: request.title?.trim() || url,
      origin: url,
      text: "",
      needsText: true,
      note: "Couldn't fetch this page automatically — paste the article text below.",
    };

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "url", url }),
      });
      if (!res.ok) return fallback;
      const data = (await res.json()) as {
        text?: string;
        title?: string;
        needsText?: boolean;
        note?: string;
      };
      if (data.needsText || !data.text?.trim()) {
        return { ...fallback, note: data.note ?? fallback.note };
      }
      return {
        type: "webpage",
        input: "url",
        title: request.title?.trim() || data.title?.trim() || url,
        origin: url,
        text: data.text.trim(),
        needsText: false,
      };
    } catch {
      return fallback;
    }
  },
};
