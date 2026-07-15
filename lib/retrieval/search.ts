/**
 * Deterministic, explainable retrieval (LIFEOS-009). No embeddings, no AI.
 *
 * Ranking signals (exact + concept weighted above recency):
 *   exact phrase · token overlap · concept overlap · title/author match ·
 *   provenance (page) · belief status · recency · user feedback.
 * Every result carries a human "why it matched" reason; raw scores are
 * never shown in the UI. Results are deduped and diversified across sources.
 */

import type { FeedbackEntry, RecordType, RetrievalRecord } from "@/types/mvp";
import { normKey } from "@/lib/dedup";

const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "her", "was", "one",
  "our", "out", "day", "get", "has", "him", "his", "how", "man", "new", "now", "old", "see",
  "two", "way", "who", "boy", "did", "its", "let", "put", "say", "she", "too", "use", "that",
  "this", "with", "from", "have", "what", "your", "they", "them", "then", "than", "into", "when",
  "will", "would", "there", "their", "about", "which", "were", "been", "being", "some", "such",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function recencyScore(iso?: string): number {
  if (!iso) return 0;
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (!isFinite(days) || days < 0) return 0.5;
  return 1 / (1 + days / 30);
}

export type Reason =
  | "Exact match"
  | "Shared concept"
  | "Title match"
  | "Related wording";

export interface RankedResult {
  record: RetrievalRecord;
  score: number;
  reason: Reason;
}

export interface SearchOptions {
  limit?: number;
  maxPerSource?: number;
  excludeSourceId?: string;
  types?: RecordType[];
  /** Exclude specific record ids (e.g. the record you're searching *from*). */
  excludeIds?: Set<string>;
}

function latestFeedback(feedback: FeedbackEntry[]): Map<string, FeedbackEntry> {
  const m = new Map<string, FeedbackEntry>();
  for (const f of feedback) {
    const prev = m.get(f.recordId);
    if (!prev || f.at > prev.at) m.set(f.recordId, f);
  }
  return m;
}

function scoreRecord(
  qNorm: string,
  qTokens: string[],
  qSet: Set<string>,
  record: RetrievalRecord,
): { score: number; reason: Reason } | null {
  const textNorm = normKey(record.text);
  const rTokens = tokenize(record.text);
  const rSet = new Set(rTokens);
  const conceptTokens = new Set((record.concepts ?? []).flatMap(tokenize));
  const titleNorm = record.title ? normKey(record.title) : "";

  const exact = qNorm.length >= 3 && textNorm.includes(qNorm) ? 1 : 0;
  const overlap = qTokens.length ? qTokens.filter((t) => rSet.has(t)).length / qTokens.length : 0;
  const conceptOverlap = qTokens.length
    ? qTokens.filter((t) => conceptTokens.has(t)).length / qTokens.length
    : 0;
  const titleMatch = titleNorm && qNorm.length >= 3 && titleNorm.includes(qNorm) ? 1 : 0;

  if (!exact && overlap === 0 && conceptOverlap === 0 && !titleMatch) return null;

  const provenance = record.page != null ? 0.3 : 0;
  const statusBoost =
    record.status === "accepted" ? 0.4 : record.status === "questioned" ? 0.3 : 0;

  const score =
    exact * 6 +
    conceptOverlap * 4 +
    overlap * 3 +
    titleMatch * 2 +
    provenance +
    statusBoost +
    recencyScore(record.updatedAt ?? record.createdAt) * 0.5;

  const reason: Reason = exact
    ? "Exact match"
    : conceptOverlap >= overlap && conceptOverlap > 0
      ? "Shared concept"
      : titleMatch
        ? "Title match"
        : "Related wording";

  // Guard against pure single-weak-token noise: require a real signal.
  if (!exact && !titleMatch && overlap < 0.34 && conceptOverlap === 0 && qTokens.length > 2) {
    return null;
  }
  void qSet;
  return { score, reason };
}

export function search(
  query: string,
  records: RetrievalRecord[],
  feedback: FeedbackEntry[],
  opts: SearchOptions = {},
): RankedResult[] {
  const qNorm = normKey(query);
  const qTokens = tokenize(query);
  if (qNorm.length < 2 && qTokens.length === 0) return [];
  const qSet = new Set(qTokens);

  const fb = latestFeedback(feedback);
  const now = new Date().toISOString();
  const limit = opts.limit ?? 20;
  const maxPerSource = opts.maxPerSource ?? 3;

  const scored: RankedResult[] = [];
  for (const record of records) {
    if (opts.excludeSourceId && record.sourceId === opts.excludeSourceId) continue;
    if (opts.excludeIds?.has(record.id)) continue;
    if (opts.types && !opts.types.includes(record.type)) continue;

    const f = fb.get(record.id);
    if (f && (f.verdict === "not_relevant" || f.verdict === "dismissed")) continue;
    if (f && f.verdict === "snoozed" && f.snoozeUntil && f.snoozeUntil > now) continue;

    const s = scoreRecord(qNorm, qTokens, qSet, record);
    if (!s) continue;
    const boost = f && f.verdict === "relevant" ? 2 : 0;
    scored.push({ record, score: s.score + boost, reason: s.reason });
  }

  scored.sort((a, b) => b.score - a.score);

  // Dedup by normalized text + diversify (per-source cap).
  const seenText = new Set<string>();
  const perSource = new Map<string, number>();
  const out: RankedResult[] = [];
  for (const r of scored) {
    const key = normKey(r.record.text).slice(0, 160);
    if (seenText.has(key)) continue;
    const src = r.record.sourceId ?? `~${r.record.type}`;
    const count = perSource.get(src) ?? 0;
    if (count >= maxPerSource) continue;
    seenText.add(key);
    perSource.set(src, count + 1);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

/** Retrieve records related to a piece of text (capture/belief/passage). */
export function relatedTo(
  text: string,
  records: RetrievalRecord[],
  feedback: FeedbackEntry[],
  opts: SearchOptions = {},
): RankedResult[] {
  return search(text, records, feedback, { limit: 5, maxPerSource: 1, ...opts });
}

/** Human label for a resurfaced record, by type/status (Phase 6). */
export function resurfaceLabel(record: RetrievalRecord): string {
  switch (record.type) {
    case "belief":
      return record.status === "questioned"
        ? "You questioned this before"
        : record.status === "rejected"
          ? "You rejected a similar idea"
          : "Related belief";
    case "revision":
      return "An earlier version of a belief";
    case "capture":
      return "You wrote something similar";
    default:
      return "From another source";
  }
}
