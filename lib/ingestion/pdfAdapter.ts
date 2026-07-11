/**
 * PDF adapter — real, page-aware text extraction (LIFEOS-008).
 *
 * Extraction happens client-side via pdf.js (`extractPdf`), storing only the
 * extracted text + page map + PDF metadata — never the binary. Scanned,
 * malformed, or password-protected PDFs are reported honestly and fall back
 * to a manual paste (with the extraction status recorded), never faked.
 */

import type { IngestionAdapter, PdfIngestionRequest } from "@/lib/ingestion/types";
import { extractPdf } from "@/lib/ingestion/pdfExtract";

export const pdfAdapter: IngestionAdapter<PdfIngestionRequest> = {
  kind: "pdf",
  label: "PDF",
  automated: true,
  async ingest(request) {
    const file = request.file;
    const name = file.name.replace(/\.pdf$/i, "");
    const uploadedAt = new Date().toISOString();

    const result = await extractPdf(file);

    const pdfMeta = {
      filename: file.name,
      size: file.size,
      pageCount: result.pageCount,
      mime: file.type || "application/pdf",
      uploadedAt,
      extractedPages: result.extractedPages,
    };

    const base = {
      type: "pdf" as const,
      input: "pdf" as const,
      title: request.title?.trim() || name,
      author: request.author?.trim() || undefined,
      origin: file.name,
      pdfMeta,
      extractionStatus: result.status,
    };

    if (!result.ok) {
      // Scanned / failed / password-protected → keep provenance, await manual text.
      return {
        ...base,
        text: "",
        needsText: true,
        note:
          result.message ??
          "Couldn't extract text from this PDF — paste it below to process it.",
        pageMap: [],
      };
    }

    return {
      ...base,
      text: result.text,
      needsText: false,
      pageMap: result.pageMap,
      note: result.message,
    };
  },
};
