/**
 * HTML export (LIFEOS-019, Phase 9). Deterministic, dependency-free — a
 * standalone, self-contained document with inline [n] citations and a numbered
 * References list. No external assets.
 */

import type { ExportDoc } from "@/lib/authoring/export/model";
import { refMarker } from "@/lib/authoring/export/model";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function toHtml(doc: ExportDoc): string {
  const parts: string[] = [];
  parts.push("<!doctype html>", '<html lang="en">', "<head>", '<meta charset="utf-8">',
    `<title>${esc(doc.title)}</title>`,
    "<style>body{max-width:42rem;margin:3rem auto;padding:0 1.25rem;font:16px/1.7 Georgia,serif;color:#1a1a1a}h1{font-size:2rem;margin-bottom:.25rem}.sub{color:#666;font-style:italic;margin-top:0}.meta{color:#555;font-size:.9rem}h2{margin-top:2.5rem;border-bottom:1px solid #eee;padding-bottom:.25rem}sup{color:#2557a7;font-size:.7em}ol.refs{color:#444;font-size:.9rem}ol.refs em{color:#888}</style>",
    "</head>", "<body>");
  parts.push(`<h1>${esc(doc.title)}</h1>`, `<p class="sub">${esc(doc.subtitle)}</p>`);
  if (doc.meta.purpose) parts.push(`<p class="meta"><strong>Purpose:</strong> ${esc(doc.meta.purpose)}</p>`);
  if (doc.meta.audience) parts.push(`<p class="meta"><strong>Audience:</strong> ${esc(doc.meta.audience)}</p>`);

  for (const s of doc.sections) {
    parts.push(`<h2>${esc(s.heading)}</h2>`);
    for (const p of s.paragraphs) {
      const marker = p.refs.length ? `<sup>${esc(refMarker(p.refs).trim())}</sup>` : "";
      parts.push(`<p>${esc(p.text)}${marker}</p>`);
    }
  }

  if (doc.references.length) {
    parts.push("<h2>References</h2>", '<ol class="refs">');
    for (const r of doc.references) parts.push(`<li>${esc(r.label)} — <em>${esc(r.kind)}</em></li>`);
    parts.push("</ol>");
  }
  parts.push("</body>", "</html>");
  return parts.join("\n");
}
