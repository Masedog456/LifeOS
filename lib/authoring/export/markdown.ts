/**
 * Markdown export (LIFEOS-019, Phase 9). Deterministic, dependency-free.
 * Citations are preserved as inline [n] markers plus a numbered References list.
 */

import type { ExportDoc } from "@/lib/authoring/export/model";
import { refMarker } from "@/lib/authoring/export/model";

export function toMarkdown(doc: ExportDoc): string {
  const lines: string[] = [];
  lines.push(`# ${doc.title}`, "");
  lines.push(`*${doc.subtitle}*`, "");
  if (doc.meta.purpose) lines.push(`**Purpose:** ${doc.meta.purpose}`, "");
  if (doc.meta.audience) lines.push(`**Audience:** ${doc.meta.audience}`, "");

  for (const s of doc.sections) {
    lines.push("", `## ${s.heading}`, "");
    for (const p of s.paragraphs) {
      lines.push(`${p.text}${refMarker(p.refs)}`, "");
    }
  }

  if (doc.references.length) {
    lines.push("", "## References", "");
    for (const r of doc.references) {
      lines.push(`${r.num}. ${r.label} — *${r.kind}*`);
    }
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
