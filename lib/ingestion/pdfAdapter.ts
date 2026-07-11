/**
 * PDF adapter — clean seam with a graceful fallback.
 *
 * Robust PDF text extraction requires a heavy, fragile dependency (PDF
 * parsing + font/encoding handling), which LIFEOS-006 deliberately does NOT
 * introduce (per the ticket: "do not hack around limitations"). Instead the
 * extraction point is isolated in `extractPdfText` below: today it returns
 * null (→ the user pastes the text in the reader, provenance preserved), and
 * a future implementation (client pdf.js or a server parser behind
 * `/api/extract` mode "pdf") drops in HERE without touching the pipeline,
 * the reader, or storage.
 */

import type { IngestionAdapter, PdfIngestionRequest } from "@/lib/ingestion/types";

/**
 * The single extraction seam. Returns extracted text, or null when
 * automatic extraction is unavailable. Intentionally does no network work
 * today (uploading bytes for a no-op would be wasteful).
 */
async function extractPdfText(file: File): Promise<string | null> {
  // A future implementation reads `file` here (client pdf.js, or POST the
  // bytes to `/api/extract` mode "pdf"). Today: no automatic extraction.
  void file;
  return null;
}

export const pdfAdapter: IngestionAdapter<PdfIngestionRequest> = {
  kind: "pdf",
  label: "PDF",
  automated: false,
  async ingest(request) {
    const name = request.file.name.replace(/\.pdf$/i, "");
    const base = {
      type: "pdf" as const,
      input: "pdf" as const,
      title: request.title?.trim() || name,
      author: request.author?.trim() || undefined,
      origin: request.file.name,
    };

    let text: string | null = null;
    try {
      text = await extractPdfText(request.file);
    } catch {
      text = null;
    }

    if (!text || !text.trim()) {
      return {
        ...base,
        text: "",
        needsText: true,
        note: "Automatic PDF extraction isn't enabled yet — paste the text below to process it.",
      };
    }
    return { ...base, text: text.trim(), needsText: false };
  },
};
