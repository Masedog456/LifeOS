/**
 * DOCX export (LIFEOS-019, Phase 9). Deterministic, dependency-free.
 *
 * Emits a minimal but valid OOXML (WordprocessingML) package via the store-only
 * zip writer: [Content_Types].xml, _rels/.rels, word/_rels/document.xml.rels,
 * and word/document.xml. Headings, paragraphs with inline [n] citation markers,
 * and a numbered References list. Opens in Word/Google Docs/LibreOffice.
 */

import type { ExportDoc } from "@/lib/authoring/export/model";
import { refMarker } from "@/lib/authoring/export/model";
import { makeZip } from "@/lib/authoring/export/zip";

function xml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function para(text: string, opts: { heading1?: boolean; heading2?: boolean } = {}): string {
  const style = opts.heading1 ? '<w:pStyle w:val="Heading1"/>' : opts.heading2 ? '<w:pStyle w:val="Heading2"/>' : "";
  const rpr = opts.heading1 || opts.heading2 ? "" : "";
  return `<w:p><w:pPr>${style}</w:pPr><w:r>${rpr}<w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
}

export function toDocx(doc: ExportDoc): Uint8Array {
  const body: string[] = [];
  body.push(para(doc.title, { heading1: true }));
  body.push(para(doc.subtitle));
  if (doc.meta.purpose) body.push(para(`Purpose: ${doc.meta.purpose}`));
  if (doc.meta.audience) body.push(para(`Audience: ${doc.meta.audience}`));

  for (const s of doc.sections) {
    body.push(para(s.heading, { heading2: true }));
    for (const p of s.paragraphs) body.push(para(`${p.text}${refMarker(p.refs)}`));
  }
  if (doc.references.length) {
    body.push(para("References", { heading2: true }));
    for (const r of doc.references) body.push(para(`${r.num}. ${r.label} — ${r.kind}`));
  }

  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${body.join("")}` +
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>' +
    "</w:body></w:document>";

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    "</Types>";

  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    "</Relationships>";

  const docRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

  return makeZip([
    { name: "[Content_Types].xml", data: utf8(contentTypes) },
    { name: "_rels/.rels", data: utf8(rels) },
    { name: "word/_rels/document.xml.rels", data: utf8(docRels) },
    { name: "word/document.xml", data: utf8(documentXml) },
  ]);
}
