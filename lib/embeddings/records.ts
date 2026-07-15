/**
 * Embeddable-record extraction (LIFEOS-015, Phase 3).
 *
 * Projects the store into the items eligible for embedding, each with a
 * content hash for idempotent indexing. Never includes keys, auth data, or
 * duplicate full-source text (chunks/summary stand in for `originalText`).
 */

import type { EmbeddableItem } from "@/lib/embeddings/types";
import type { StoreState } from "@/types/mvp";
import { hashText } from "@/lib/hash";

export function embeddableItems(state: StoreState): EmbeddableItem[] {
  const out: EmbeddableItem[] = [];
  const push = (recordId: string, type: EmbeddableItem["type"], text: string, sourceId?: string) => {
    const t = text.trim();
    if (t.length < 3) return;
    out.push({ recordId, type, sourceId, text: t, contentHash: hashText(t) });
  };

  for (const s of state.sources) {
    if (s.summary) push(`summary:${s.id}`, "summary", s.summary, s.id);
    for (const ch of s.chunks ?? []) push(`chunk:${ch.id}`, "chunk", ch.text, s.id);
    (s.keyQuotes ?? []).forEach((q, i) => push(`quote:${s.id}:${i}`, "quote", q, s.id));
  }
  for (const c of state.captures) push(`capture:${c.id}`, "capture", c.text, c.sourceId);
  for (const b of state.beliefs) {
    push(`belief:${b.id}`, "belief", b.text);
    for (let i = 0; i < b.revisions.length - 1; i++) {
      const r = b.revisions[i];
      if (r.text && r.text !== b.text) push(`revision:${b.id}:${i}`, "revision", r.text);
    }
  }
  for (const cmp of state.comparisons) {
    cmp.result.agreements.forEach((p, i) => push(`cmpfind:${cmp.id}:a${i}`, "comparison_finding", p.statement));
    cmp.result.disagreements.forEach((p, i) => push(`cmpfind:${cmp.id}:d${i}`, "comparison_finding", p.statement));
  }
  for (const inq of state.inquiries) {
    inq.result.affirmativeCase.forEach((p, i) => push(`inqfind:${inq.id}:a${i}`, "inquiry_finding", p.statement));
    inq.result.negativeCase.forEach((p, i) => push(`inqfind:${inq.id}:n${i}`, "inquiry_finding", p.statement));
  }
  for (const t of state.megathreads) {
    if (t.synthesis?.currentUnderstanding) push(`threadsyn:${t.id}`, "thread_synthesis", t.synthesis.currentUnderstanding);
  }
  for (const r of state.reflections) push(`reflection:${r.id}`, "reflection", r.response);

  return out;
}
