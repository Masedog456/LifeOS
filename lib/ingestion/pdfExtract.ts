/**
 * Client-side, page-aware PDF text extraction (LIFEOS-008).
 *
 * Runs in the browser via pdf.js (dynamic import — not in the main bundle).
 * We extract text per page, keep a page → char-range map, and store ONLY
 * the extracted text + metadata — never the binary. Scanned / malformed /
 * password-protected PDFs are detected and reported honestly, never faked.
 */

import type { ExtractionStatus, PageSpan } from "@/types/mvp";
import { normalizeText } from "@/lib/textNormalize";

// ---- conservative limits (Phase 5) ----
export const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_PAGES = 1500;
const MAX_EXTRACT_CHARS = 600_000;
const MIN_CHARS_PER_PAGE = 8; // below this ⇒ likely scanned

export interface PdfExtractResult {
  ok: boolean;
  status: ExtractionStatus;
  text: string;
  pageMap: PageSpan[];
  pageCount: number;
  extractedPages: number;
  /** User-facing message (never contains document text). */
  message?: string;
}

interface PdfTextItem {
  str?: string;
  hasEOL?: boolean;
}

function itemsToText(items: PdfTextItem[]): string {
  let out = "";
  for (const it of items) {
    if (typeof it.str !== "string") continue;
    out += it.str;
    out += it.hasEOL ? "\n" : " ";
  }
  return out;
}

function fail(status: ExtractionStatus, message: string): PdfExtractResult {
  return { ok: false, status, text: "", pageMap: [], pageCount: 0, extractedPages: 0, message };
}

export async function extractPdf(file: File): Promise<PdfExtractResult> {
  if (file.type && file.type !== "application/pdf") {
    return fail("extraction_failed", "Not a PDF file.");
  }
  if (file.size > MAX_PDF_BYTES) {
    return fail(
      "extraction_failed",
      `PDF is too large (${Math.round(file.size / 1024 / 1024)} MB; limit ${MAX_PDF_BYTES / 1024 / 1024} MB).`,
    );
  }

  let pdfjs: typeof import("pdfjs-dist");
  try {
    pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
  } catch {
    return fail("extraction_failed", "PDF engine failed to load.");
  }

  const data = new Uint8Array(await file.arrayBuffer());
  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  try {
    doc = await pdfjs.getDocument({ data }).promise;
  } catch (e) {
    const name = e && typeof e === "object" && "name" in e ? String((e as { name: unknown }).name) : "";
    if (name === "PasswordException") {
      return fail("extraction_failed", "This PDF is password-protected.");
    }
    return fail("extraction_failed", "Could not read this PDF (it may be corrupt).");
  }

  const pageCount = doc.numPages;
  const pagesToRead = Math.min(pageCount, MAX_PAGES);
  const pageMap: PageSpan[] = [];
  let text = "";
  let capped = pagesToRead < pageCount;

  try {
    for (let p = 1; p <= pagesToRead; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const seg = normalizeText(itemsToText(content.items as PdfTextItem[]));
      if (seg.length === 0) {
        pageMap.push({ page: p, start: text.length, end: text.length });
        continue;
      }
      if (text.length > 0) text += "\n\n";
      const start = text.length;
      text += seg;
      pageMap.push({ page: p, start, end: text.length });
      if (text.length > MAX_EXTRACT_CHARS) {
        capped = true;
        break;
      }
    }
  } catch {
    // Partial extraction is still useful — keep what we have.
    capped = true;
  }
  void doc.cleanup?.();

  const extractedPages = pageMap.length;
  const total = text.trim().length;
  const perPage = extractedPages > 0 ? total / extractedPages : 0;

  if (total < 20 || perPage < MIN_CHARS_PER_PAGE) {
    return {
      ok: false,
      status: "scanned_ocr_required",
      text: "",
      pageMap: [],
      pageCount,
      extractedPages,
      message: "Little or no selectable text found — this looks like a scanned PDF (OCR required).",
    };
  }

  return {
    ok: true,
    status: capped ? "partial_text" : "text_extracted",
    text,
    pageMap,
    pageCount,
    extractedPages,
    message: capped ? `Extracted ${extractedPages} of ${pageCount} page(s).` : undefined,
  };
}
