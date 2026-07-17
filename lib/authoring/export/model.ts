/**
 * Export document model (LIFEOS-019, Phase 9).
 *
 * Normalizes a project into a deterministic, format-agnostic document: title,
 * metadata, sections with paragraph-level citation NUMBERS, and a numbered
 * reference list (first-appearance order). Every exporter (Markdown/HTML/DOCX/
 * PDF) renders this same model, so citations are preserved identically across
 * formats. Pure and offline.
 */

import type { KnowledgeProject, StoreState } from "@/types/mvp";
import { citationIndex, type ResolvedCitation } from "@/lib/authoring/citations";
import { projectKindLabel } from "@/lib/authoring/outline";

export interface ExportParagraph {
  text: string;
  /** 1-based reference numbers cited by this paragraph. */
  refs: number[];
}
export interface ExportSection {
  heading: string;
  paragraphs: ExportParagraph[];
}
export interface ExportReference {
  num: number;
  label: string;
  kind: string;
}
export interface ExportDoc {
  title: string;
  subtitle: string;
  meta: { purpose?: string; audience?: string };
  sections: ExportSection[];
  references: ExportReference[];
}

export function buildExportDoc(state: StoreState, project: KnowledgeProject): ExportDoc {
  const index = citationIndex(state, project);
  const refNum = new Map<string, number>();
  const references: ExportReference[] = [];

  const numFor = (id: string): number | null => {
    const r: ResolvedCitation | undefined = index.get(id);
    if (!r) return null;
    if (!refNum.has(id)) {
      const n = references.length + 1;
      refNum.set(id, n);
      references.push({ num: n, label: r.label, kind: r.kind });
    }
    return refNum.get(id)!;
  };

  const sections: ExportSection[] = [...project.sections]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      heading: s.heading,
      paragraphs: s.paragraphs.map((p) => ({
        text: p.text,
        refs: p.citations.map(numFor).filter((n): n is number => n !== null),
      })),
    }));

  return {
    title: project.title || "Untitled",
    subtitle: projectKindLabel(project.kind),
    meta: { purpose: project.purpose || undefined, audience: project.audience || undefined },
    sections,
    references,
  };
}

/** Inline citation marker, e.g. " [1, 3]". Shared by the text-based exporters. */
export function refMarker(refs: number[]): string {
  return refs.length ? ` [${refs.join(", ")}]` : "";
}
