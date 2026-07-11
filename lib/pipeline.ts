/**
 * Long-source processing pipeline (LIFEOS-003 → restructured LIFEOS-006 →
 * map/reduce over chunks in LIFEOS-007).
 *
 * A source is analyzed from its FULL content via chunk-level map/reduce, not
 * just its opening prefix, while staying cost-aware:
 *
 *   normalize → chunk (stable, with offsets) → select chunks (by mode) →
 *   MAP each selected chunk (1 AI call each) → REDUCE:
 *     · concepts / quotes / beliefs  = deterministic dedup (0 AI calls)
 *     · summary                      = 1 AI call (skipped when 1 chunk)
 *
 * Modes: quick (representative subset, labeled sampled) · full (all chunks
 * up to a safety cap). Everything degrades to deterministic mock on failure.
 * Candidate beliefs are stored on the source only — never auto-sent to the
 * Inbox or Constitution.
 */

import { mapChunk, reduceSummary } from "@/lib/aiClient";
import { dedupStrings } from "@/lib/dedup";
import { getSource, patchSource, setProcessingState } from "@/lib/mvpStore";
import type {
  AnalysisMeta,
  ChunkResult,
  Coverage,
  KnowledgeChunk,
  ProcessingMode,
  StageName,
  StageStatus,
} from "@/types/mvp";

// ---- cost-control policy ----
const CHUNK_TARGET = 1200;
export const QUICK_CHUNKS = 3; // representative subset for Quick
export const FULL_CHUNK_LIMIT = 40; // safety cap for Full
const MAP_CONCURRENCY = 3;

// ---- cooperative cancellation (per source) ----
const cancelFlags = new Map<string, boolean>();
export function cancelAnalysis(sourceId: string): void {
  cancelFlags.set(sourceId, true);
}
function beginRun(sourceId: string): void {
  cancelFlags.set(sourceId, false);
}
function cancelled(sourceId: string): boolean {
  return cancelFlags.get(sourceId) === true;
}
class Cancelled extends Error {}

// ---- text + chunking ----

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t\f]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Deterministic chunking with character offsets into the normalized text.
 * Same text → same chunks (stable ids/boundaries across reruns).
 */
export function buildChunks(sourceId: string, text: string): KnowledgeChunk[] {
  const regions: Array<[number, number]> = [];
  const paraRe = /[^\n]+(?:\n(?!\n)[^\n]+)*/g;
  let m: RegExpExecArray | null;
  while ((m = paraRe.exec(text)) !== null) regions.push([m.index, m.index + m[0].length]);
  if (regions.length === 0 && text.trim()) regions.push([0, text.length]);

  const spans: Array<[number, number]> = [];
  let curStart = -1;
  let curEnd = -1;
  const flush = () => {
    if (curStart >= 0) spans.push([curStart, curEnd]);
    curStart = -1;
    curEnd = -1;
  };
  for (const [s, e] of regions) {
    if (e - s > CHUNK_TARGET) {
      flush();
      let p = s;
      while (p < e) {
        let q = Math.min(p + CHUNK_TARGET, e);
        if (q < e) {
          const ws = text.lastIndexOf(" ", q);
          if (ws > p) q = ws;
        }
        spans.push([p, q]);
        p = q;
        while (p < e && text[p] === " ") p++;
      }
      continue;
    }
    if (curStart < 0) {
      curStart = s;
      curEnd = e;
    } else if (e - curStart > CHUNK_TARGET) {
      flush();
      curStart = s;
      curEnd = e;
    } else {
      curEnd = e;
    }
  }
  flush();

  return spans.map(([start, end], index) => ({
    id: `${sourceId}:c${index}`,
    sourceId,
    index,
    start,
    end,
    text: text.slice(start, end).trim(),
  }));
}

/** Chunks are stable: only (re)build when missing or lacking offsets. */
function ensureChunks(sourceId: string, norm: string): KnowledgeChunk[] {
  const existing = getSource(sourceId)?.chunks ?? [];
  const usable = existing.length > 0 && existing.every((c) => typeof c.start === "number");
  if (usable) return existing;
  const chunks = buildChunks(sourceId, norm);
  patchSource(sourceId, { chunks });
  return chunks;
}

/** Evenly-spaced representative subset — samples beyond the opening prefix. */
function selectRepresentative(chunks: KnowledgeChunk[], k: number): KnowledgeChunk[] {
  if (chunks.length <= k) return chunks;
  const picked = new Map<number, KnowledgeChunk>();
  const step = (chunks.length - 1) / (k - 1);
  for (let i = 0; i < k; i++) {
    const idx = Math.round(i * step);
    picked.set(idx, chunks[idx]);
  }
  return [...picked.values()].sort((a, b) => a.index - b.index);
}

// ---- cost estimate (before running) ----

function estimateTotalChunks(sourceId: string): number {
  const src = getSource(sourceId);
  if (src?.chunks?.length) return src.chunks.length;
  const len = normalize(src?.originalText ?? "").length;
  return Math.max(1, Math.ceil(len / CHUNK_TARGET));
}

export function estimateCalls(sourceId: string, mode: ProcessingMode): number {
  const total = estimateTotalChunks(sourceId);
  const selected =
    mode === "quick" ? Math.min(QUICK_CHUNKS, total) : Math.min(FULL_CHUNK_LIMIT, total);
  return selected + (selected > 1 ? 1 : 0);
}

// ---- map stage ----

async function mapChunks(
  sourceId: string,
  chunks: KnowledgeChunk[],
  existing: Map<string, ChunkResult>,
): Promise<{ results: ChunkResult[]; allAi: boolean }> {
  const out: ChunkResult[] = [];
  let allAi = true;
  let cursor = 0;

  async function worker() {
    while (cursor < chunks.length) {
      if (cancelled(sourceId)) throw new Cancelled();
      const chunk = chunks[cursor++];
      const cached = existing.get(chunk.id);
      if (cached) {
        out.push(cached);
        if (cached.source !== "ai") allAi = false;
        continue;
      }
      const { result, source } = await mapChunk(chunk.text);
      if (source !== "ai") allAi = false;
      // Lift chunk-local quote offsets into source offsets.
      const base = typeof chunk.start === "number" ? chunk.start : 0;
      const quotes = result.quotes.map((q) => ({
        text: q.text,
        start: typeof q.start === "number" ? base + q.start : undefined,
        end: typeof q.end === "number" ? base + q.end : undefined,
      }));
      out.push({
        chunkId: chunk.id,
        index: chunk.index,
        summary: result.summary,
        concepts: result.concepts,
        quotes,
        claims: result.claims,
        source,
      });
    }
  }

  const workers = Array.from({ length: Math.min(MAP_CONCURRENCY, chunks.length) }, worker);
  await Promise.all(workers);
  out.sort((a, b) => a.index - b.index);
  return { results: out, allAi };
}

function mergeChunkResults(prev: ChunkResult[], next: ChunkResult[]): ChunkResult[] {
  const byId = new Map(prev.map((r) => [r.chunkId, r]));
  for (const r of next) byId.set(r.chunkId, r);
  return [...byId.values()].sort((a, b) => a.index - b.index);
}

// ---- reduce (deterministic) ----

function reduceConcepts(results: ChunkResult[]): string[] {
  return dedupStrings(results.flatMap((r) => r.concepts)).slice(0, 24);
}

/** Verify each candidate quote is an exact substring of the source text. */
function reduceQuotes(results: ChunkResult[], norm: string): { quotes: string[]; unmatched: number } {
  const candidates = dedupStrings(results.flatMap((r) => r.quotes.map((q) => q.text)));
  const quotes: string[] = [];
  let unmatched = 0;
  for (const q of candidates) {
    if (norm.includes(q)) quotes.push(q);
    else unmatched++;
  }
  return { quotes: quotes.slice(0, 24), unmatched };
}

function reduceBeliefs(results: ChunkResult[]): string[] {
  return dedupStrings(results.flatMap((r) => r.claims)).slice(0, 20);
}

// ---- orchestration ----

function setStages(sourceId: string, patch: Partial<Record<StageName, StageStatus>>): void {
  const cur = getSource(sourceId)?.stages;
  patchSource(sourceId, {
    stages: {
      summary: "not_started",
      quotes: "not_started",
      concepts: "not_started",
      beliefs: "not_started",
      ...cur,
      ...patch,
    },
  });
}

/**
 * Analyze a source in quick or full mode. Partial results are persisted
 * incrementally, so a later stage failing never erases an earlier one.
 */
export async function analyzeSource(
  sourceId: string,
  originalText: string,
  mode: ProcessingMode = "quick",
): Promise<void> {
  beginRun(sourceId);
  const norm = normalize(originalText);
  try {
    setProcessingState(sourceId, "processing");
    setStages(sourceId, { summary: "processing", quotes: "processing", concepts: "processing", beliefs: "processing" });

    const chunks = ensureChunks(sourceId, norm);
    const total = chunks.length;
    const selected =
      mode === "quick" ? selectRepresentative(chunks, QUICK_CHUNKS) : chunks.slice(0, FULL_CHUNK_LIMIT);

    // MAP (skip already-mapped chunks → idempotent, resumable).
    const existing = new Map((getSource(sourceId)?.chunkResults ?? []).map((r) => [r.chunkId, r]));
    const { results, allAi } = await mapChunks(sourceId, selected, existing);
    const merged = mergeChunkResults(getSource(sourceId)?.chunkResults ?? [], results);

    // REDUCE (deterministic) over just this run's selected chunks.
    const concepts = reduceConcepts(results);
    const { quotes, unmatched } = reduceQuotes(results, norm);
    const beliefs = reduceBeliefs(results);
    const existingQuotes = getSource(sourceId)?.keyQuotes ?? [];

    const coverage: Coverage = selected.length >= total ? "full" : "sampled";
    const derived: "ai" | "mock" = allAi ? "ai" : "mock";
    const analysis: AnalysisMeta = {
      mode,
      coverage,
      chunksAnalyzed: selected.length,
      totalChunks: total,
      source: derived,
      unmatchedQuotes: unmatched,
      updatedAt: new Date().toISOString(),
    };

    // Persist the deterministic artifacts first (survive a summary failure).
    patchSource(sourceId, {
      chunkResults: merged,
      keyConcepts: concepts,
      keyQuotes: dedupStrings([...existingQuotes, ...quotes]),
      candidateBeliefs: beliefs,
      derivedSource: derived,
      analysis,
    });
    setStages(sourceId, { concepts: "processed", quotes: "processed", beliefs: "processed", summary: "processing" });

    // REDUCE summary (AI, or reuse single chunk's summary).
    if (cancelled(sourceId)) throw new Cancelled();
    if (results.length === 1) {
      patchSource(sourceId, { summary: results[0].summary });
    } else if (results.length > 1) {
      const { result } = await reduceSummary(results.map((r) => r.summary));
      patchSource(sourceId, { summary: result });
    }
    setStages(sourceId, { summary: "processed" });

    setProcessingState(sourceId, coverage === "full" ? "ready" : "partial");
  } catch (e) {
    if (e instanceof Cancelled) {
      setProcessingState(sourceId, "cancelled");
    } else {
      // Partial results already persisted; only mark overall failure.
      setProcessingState(sourceId, "error", e instanceof Error ? e.message : "analysis failed");
    }
  }
}

/** Re-run one stage from existing chunk results (only summary costs an AI call). */
export async function runStage(sourceId: string, stage: StageName): Promise<void> {
  const src = getSource(sourceId);
  if (!src) return;
  const results = src.chunkResults ?? [];
  const norm = normalize(src.originalText);
  const only = (status: StageStatus): Partial<Record<StageName, StageStatus>> => ({ [stage]: status });
  setStages(sourceId, only("processing"));
  try {
    if (stage === "concepts") {
      patchSource(sourceId, { keyConcepts: reduceConcepts(results) });
    } else if (stage === "quotes") {
      const { quotes } = reduceQuotes(results, norm);
      patchSource(sourceId, { keyQuotes: dedupStrings([...(src.keyQuotes ?? []), ...quotes]) });
    } else if (stage === "beliefs") {
      patchSource(sourceId, { candidateBeliefs: reduceBeliefs(results) });
    } else if (stage === "summary") {
      if (results.length === 1) {
        patchSource(sourceId, { summary: results[0].summary });
      } else if (results.length > 1) {
        const { result } = await reduceSummary(results.map((r) => r.summary));
        patchSource(sourceId, { summary: result });
      }
    }
    setStages(sourceId, only("processed"));
  } catch (e) {
    setStages(sourceId, only("failed"));
    setProcessingState(sourceId, "error", e instanceof Error ? e.message : "stage failed");
  }
}

/** Backward-compatible entry used by ingestion: conservative Quick analysis. */
export async function processSource(sourceId: string, originalText: string): Promise<void> {
  return analyzeSource(sourceId, originalText, "quick");
}
