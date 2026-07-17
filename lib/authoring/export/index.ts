/**
 * Export entry point (LIFEOS-019, Phase 9).
 *
 * One deterministic function per project → { filename, mime, data } for each
 * supported format. All four render the same `ExportDoc`, so citations are
 * preserved identically. Dependency-free.
 */

import type { KnowledgeProject, StoreState } from "@/types/mvp";
import { buildExportDoc } from "@/lib/authoring/export/model";
import { toMarkdown } from "@/lib/authoring/export/markdown";
import { toHtml } from "@/lib/authoring/export/html";
import { toDocx } from "@/lib/authoring/export/docx";
import { toPdf } from "@/lib/authoring/export/pdf";

export type ExportFormat = "markdown" | "html" | "docx" | "pdf";

export const EXPORT_FORMATS: ExportFormat[] = ["markdown", "html", "docx", "pdf"];

const EXT: Record<ExportFormat, string> = { markdown: "md", html: "html", docx: "docx", pdf: "pdf" };
const MIME: Record<ExportFormat, string> = {
  markdown: "text/markdown",
  html: "text/html",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

function slug(s: string): string {
  return (s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project").slice(0, 60);
}

export function exportProject(
  state: StoreState,
  project: KnowledgeProject,
  format: ExportFormat,
): { filename: string; mime: string; data: string | Uint8Array } {
  const doc = buildExportDoc(state, project);
  const filename = `${slug(project.title)}.${EXT[format]}`;
  const mime = MIME[format];
  switch (format) {
    case "markdown": return { filename, mime, data: toMarkdown(doc) };
    case "html": return { filename, mime, data: toHtml(doc) };
    case "docx": return { filename, mime, data: toDocx(doc) };
    case "pdf": return { filename, mime, data: toPdf(doc) };
  }
}
