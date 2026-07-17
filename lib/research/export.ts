/**
 * Research export (LIFEOS-020, Phase 9).
 *
 * Maps a research project into the SAME `ExportDoc` model the Authoring Engine
 * uses (LIFEOS-019), then reuses its deterministic, dependency-free writers
 * (Markdown/HTML/DOCX/PDF). Questions, hypotheses, the argument map, gaps, and
 * the evidence list are rendered; evidence records become numbered citations,
 * so provenance is preserved in every format. No duplication of the export code.
 */

import type { ResearchProject, StoreState } from "@/types/mvp";
import type { ExportDoc, ExportSection } from "@/lib/authoring/export/model";
import { assembleEvidence } from "@/lib/authoring/assembly";
import { toMarkdown } from "@/lib/authoring/export/markdown";
import { toHtml } from "@/lib/authoring/export/html";
import { toDocx } from "@/lib/authoring/export/docx";
import { toPdf } from "@/lib/authoring/export/pdf";
import type { ExportFormat } from "@/lib/authoring/export";
import { detectResearchGaps } from "@/lib/research/gaps";

const EXT: Record<ExportFormat, string> = { markdown: "md", html: "html", docx: "docx", pdf: "pdf" };
const MIME: Record<ExportFormat, string> = {
  markdown: "text/markdown",
  html: "text/html",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

function slug(s: string): string {
  return (s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "research").slice(0, 60);
}

export function researchExportDoc(state: StoreState, p: ResearchProject): ExportDoc {
  const evidence = assembleEvidence(state, p.assembly);
  const refNum = new Map<string, number>();
  const references: ExportDoc["references"] = [];
  const numFor = (id: string): number | null => {
    const e = evidence.find((x) => x.id === id);
    if (!e) return null;
    if (!refNum.has(id)) {
      refNum.set(id, references.length + 1);
      references.push({ num: references.length + 1, label: e.label, kind: e.kind });
    }
    return refNum.get(id)!;
  };
  const refs = (ids: string[]) => ids.map(numFor).filter((n): n is number => n !== null);

  const sections: ExportSection[] = [];
  const para = (text: string, citeIds: string[] = []) => ({ text, refs: refs(citeIds) });

  // Primary question + description/purpose/scope.
  sections.push({
    heading: "Research question",
    paragraphs: [
      para(p.question || "(no question stated)"),
      ...(p.description ? [para(p.description)] : []),
      ...(p.purpose ? [para(`Purpose: ${p.purpose}`)] : []),
      ...(p.scope ? [para(`Scope: ${p.scope}`)] : []),
    ],
  });

  const listSection = (heading: string, items: { text: string }[]) => {
    if (items.length) sections.push({ heading, paragraphs: items.map((i) => para(i.text)) });
  };
  listSection("Subquestions", p.questions.subquestions);
  listSection("Unknowns", p.questions.unknowns);
  listSection("Assumptions", p.questions.assumptions);
  if (p.questions.definitions.length) sections.push({ heading: "Definitions", paragraphs: p.questions.definitions.map((d) => para(`${d.term}: ${d.definition}`)) });
  listSection("Success criteria", p.questions.successCriteria);
  listSection("Open problems", p.questions.openProblems);

  // Hypotheses with evidence citations.
  if (p.hypotheses.length) {
    sections.push({
      heading: "Hypotheses",
      paragraphs: p.hypotheses.map((h) =>
        para(`(${h.confidence} confidence, ${h.status}) ${h.statement}`, [...h.supportingEvidence, ...h.contradictingEvidence]),
      ),
    });
  }

  // Argument map.
  if (p.argumentNodes.length) {
    const byId = new Map(p.argumentNodes.map((n) => [n.id, n]));
    const nodeParas = p.argumentNodes.map((n) => para(`[${n.kind.replace(/_/g, " ")}] ${n.text}`, n.recordId ? [n.recordId] : []));
    const edgeParas = p.argumentEdges.map((e) => {
      const from = byId.get(e.fromId)?.text ?? "?";
      const to = byId.get(e.toId)?.text ?? "?";
      return para(`${from.slice(0, 40)} — ${e.kind.replace(/_/g, " ")} → ${to.slice(0, 40)}`);
    });
    sections.push({ heading: "Argument map", paragraphs: [...nodeParas, ...edgeParas] });
  }

  // Gaps.
  const gaps = detectResearchGaps(state, p);
  if (gaps.length) sections.push({ heading: "Open gaps", paragraphs: gaps.map((g) => para(`[${g.kind.replace(/_/g, " ")}] ${g.title} — ${g.detail}`)) });

  // Evidence list.
  if (evidence.length) sections.push({ heading: "Evidence", paragraphs: evidence.map((e) => para(`${e.label} (${e.kind})`, [e.id])) });

  return {
    title: p.title || "Untitled research",
    subtitle: "Research project",
    meta: { purpose: p.purpose || undefined },
    sections,
    references,
  };
}

export function exportResearch(
  state: StoreState,
  p: ResearchProject,
  format: ExportFormat,
): { filename: string; mime: string; data: string | Uint8Array } {
  const doc = researchExportDoc(state, p);
  const filename = `${slug(p.title)}.${EXT[format]}`;
  const mime = MIME[format];
  switch (format) {
    case "markdown": return { filename, mime, data: toMarkdown(doc) };
    case "html": return { filename, mime, data: toHtml(doc) };
    case "docx": return { filename, mime, data: toDocx(doc) };
    case "pdf": return { filename, mime, data: toPdf(doc) };
  }
}
