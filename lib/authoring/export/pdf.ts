/**
 * PDF export (LIFEOS-019, Phase 9). Deterministic, dependency-free.
 *
 * A minimal PDF writer using the built-in Helvetica font (no embedding): text
 * objects with word-wrapping and pagination, headings, inline [n] citation
 * markers, and a numbered References list. Not typographically fancy — a clean,
 * portable, citation-preserving document produced with pure TypeScript.
 */

import type { ExportDoc } from "@/lib/authoring/export/model";
import { refMarker } from "@/lib/authoring/export/model";

interface Line { text: string; size: number; gapBefore: number }

const PAGE_W = 612, PAGE_H = 792, MARGIN = 72;
const MAX_W = PAGE_W - MARGIN * 2;

/** Approx Helvetica width per char (avg) at a given size, for wrapping. */
function charsPerLine(size: number): number {
  return Math.max(10, Math.floor(MAX_W / (size * 0.5)));
}

function wrap(text: string, size: number): string[] {
  const max = charsPerLine(size);
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur.length + w.length + 1 > max && cur) { out.push(cur); cur = w; }
    else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}

function pdfEscape(s: string): string {
  // Replace non-ASCII (Helvetica/WinAnsi can't render arbitrary UTF-8) + escape.
  return s.replace(/[^\x20-\x7e]/g, "-").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildLines(doc: ExportDoc): Line[] {
  const lines: Line[] = [];
  lines.push({ text: doc.title, size: 20, gapBefore: 0 });
  lines.push({ text: doc.subtitle, size: 11, gapBefore: 6 });
  if (doc.meta.purpose) for (const l of wrap(`Purpose: ${doc.meta.purpose}`, 10)) lines.push({ text: l, size: 10, gapBefore: 2 });
  if (doc.meta.audience) for (const l of wrap(`Audience: ${doc.meta.audience}`, 10)) lines.push({ text: l, size: 10, gapBefore: 2 });

  for (const s of doc.sections) {
    lines.push({ text: s.heading, size: 15, gapBefore: 18 });
    for (const p of s.paragraphs) {
      const wrapped = wrap(`${p.text}${refMarker(p.refs)}`, 11);
      wrapped.forEach((l, i) => lines.push({ text: l, size: 11, gapBefore: i === 0 ? 10 : 2 }));
    }
  }
  if (doc.references.length) {
    lines.push({ text: "References", size: 15, gapBefore: 18 });
    for (const r of doc.references) for (const l of wrap(`${r.num}. ${r.label} - ${r.kind}`, 10)) lines.push({ text: l, size: 10, gapBefore: 3 });
  }
  return lines;
}

/** Paginate lines into content streams (one per page). */
function paginate(lines: Line[]): string[] {
  const pages: string[] = [];
  let body: string[] = [];
  let y = PAGE_H - MARGIN;

  const flush = () => { if (body.length) { pages.push(body.join("\n")); body = []; } };

  for (const ln of lines) {
    const lineH = ln.size * 1.3;
    y -= ln.gapBefore;
    if (y - lineH < MARGIN) { flush(); y = PAGE_H - MARGIN; }
    y -= lineH;
    body.push(`BT /F1 ${ln.size} Tf 1 0 0 1 ${MARGIN} ${y.toFixed(1)} Tm (${pdfEscape(ln.text)}) Tj ET`);
  }
  flush();
  return pages.length ? pages : [""];
}

export function toPdf(doc: ExportDoc): Uint8Array {
  const pageStreams = paginate(buildLines(doc));
  const objects: string[] = [];

  // 1 Catalog, 2 Pages, 3 Font, then per page: [content, page].
  const pageObjNums: number[] = [];
  let nextObj = 4;
  const contentObjs: { num: number; stream: string }[] = [];
  for (const stream of pageStreams) {
    const contentNum = nextObj++;
    const pageNum = nextObj++;
    contentObjs.push({ num: contentNum, stream });
    pageObjNums.push(pageNum);
  }

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageObjNums.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  for (let i = 0; i < contentObjs.length; i++) {
    const { num, stream } = contentObjs[i];
    const pageNum = pageObjNums[i];
    objects[num] = `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`;
    objects[pageNum] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${num} 0 R >>`;
  }

  // Serialize with an xref table.
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const offsets: number[] = [];
  const push = (s: string) => { const b = enc.encode(s); chunks.push(b); offset += b.length; };

  push("%PDF-1.4\n");
  const total = objects.length - 1; // objects are 1-indexed
  for (let i = 1; i <= total; i++) {
    offsets[i] = offset;
    push(`${i} 0 obj\n${objects[i]}\nendobj\n`);
  }
  const xrefStart = offset;
  push(`xref\n0 ${total + 1}\n`);
  push("0000000000 65535 f \n");
  for (let i = 1; i <= total; i++) push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  const len = chunks.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
