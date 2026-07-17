/**
 * Section-draft validation (LIFEOS-019, Phase 6).
 *
 * A drafted section is a list of paragraphs, each of which should cite evidence
 * ids from the assembled packet. Citations are filtered to REAL ids; a
 * paragraph that cites nothing valid is kept but marked unsupported (the UI
 * surfaces it and lets the user remove it). We never invent citations, and we
 * never silently drop the user's prose.
 */

import type { DraftParagraph } from "@/types/mvp";

function id(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? `pg_${crypto.randomUUID()}` : `pg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function ids(v: unknown, valid: Set<string>): string[] {
  return Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => x.trim()))].filter((x) => valid.has(x))
    : [];
}

/** Parse an AI/mock section result into validated paragraphs (citations filtered to real ids). */
export function validateSectionDraft(raw: unknown, valid: Set<string>): { paragraphs: DraftParagraph[]; unsupported: number } {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const arr = Array.isArray(obj.paragraphs) ? obj.paragraphs : Array.isArray(raw) ? (raw as unknown[]) : [];
  const paragraphs: DraftParagraph[] = [];
  let unsupported = 0;

  for (const p of arr.slice(0, 40)) {
    const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    const text = str(o.text);
    if (!text) continue;
    const citations = ids(o.citations, valid);
    if (citations.length === 0) unsupported++;
    paragraphs.push({ id: id(), text, citations });
  }
  return { paragraphs, unsupported };
}

/** Paragraphs with no valid citation — the "unsupported statements" the UI shows. */
export function unsupportedParagraphs(paragraphs: DraftParagraph[]): DraftParagraph[] {
  return paragraphs.filter((p) => p.citations.length === 0);
}
