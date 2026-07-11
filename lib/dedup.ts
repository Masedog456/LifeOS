/**
 * Lightweight, deterministic deduplication (LIFEOS-007 Phase 8).
 *
 * Conservative on purpose: two items are "the same" only if they normalize
 * to the same key (case/punctuation/whitespace-insensitive). This merges
 * obvious repeats without collapsing genuinely distinct ideas that merely
 * share a keyword. This is NOT canonical identity resolution.
 */

export function normKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Dedup a list of strings, preserving first-seen order and original casing. */
export function dedupStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    const key = normKey(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}
