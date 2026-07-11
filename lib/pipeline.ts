/**
 * The knowledge processing pipeline (LIFEOS-003, restructured LIFEOS-006).
 *
 * A source moves through an ORDERED, REPLACEABLE list of stages. Each stage
 * reads/writes via the store and updates the source's processing state, so
 * any stage can be swapped, reordered, or added without changing the others
 * or the rest of the system. The immutable `originalText` is never mutated;
 * a normalized working copy is passed through the pipeline context.
 *
 * Full stage map (Capture → … → Inbox):
 *   Capture         — done at ingestion (adapter + addSource), before this runs
 *   Extraction      — done by the ingestion adapter (raw → text)
 *   Normalization   — normalizeStage
 *   Chunking        — chunkStage
 *   Metadata        — metadataStage (captured at ingestion; seam for derived meta)
 *   Summary         — summaryStage        (AI)
 *   Quotes          — quotesStage         (AI)
 *   Concepts        — conceptsStage       (AI)
 *   Claims          — beliefCandidatesStage (AI)
 *   Questions       — questionsStage      (inactive seam — no AI cost yet)
 *   Relationships   — relationshipsStage  (inactive seam)
 *   Library         — the source IS in the library throughout
 *   Inbox           — user sends candidates to the Belief Inbox (never automatic)
 *
 * Candidate beliefs are stored on the source only; they never auto-enter the
 * Belief Inbox or the Constitution.
 */

import {
  extractConcepts,
  extractQuotes,
  generateBeliefs,
  summarize,
} from "@/lib/aiClient";
import { patchSource, setProcessingState } from "@/lib/mvpStore";
import type { KnowledgeChunk } from "@/types/mvp";

const CHUNK_TARGET = 1200;
const MAX_MODEL_CHARS = 8000;

/** Split text into ~CHUNK_TARGET-sized chunks on paragraph/sentence boundaries. */
export function chunkText(text: string): KnowledgeChunk[] {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const pieces: string[] = [];
  let buf = "";
  for (const p of paras) {
    if (buf && buf.length + p.length > CHUNK_TARGET) {
      pieces.push(buf.trim());
      buf = "";
    }
    if (p.length > CHUNK_TARGET) {
      if (buf) {
        pieces.push(buf.trim());
        buf = "";
      }
      for (const sentence of p.split(/(?<=[.!?])\s+/)) {
        if (buf && buf.length + sentence.length > CHUNK_TARGET) {
          pieces.push(buf.trim());
          buf = "";
        }
        buf += (buf ? " " : "") + sentence;
      }
    } else {
      buf += (buf ? "\n\n" : "") + p;
    }
  }
  if (buf.trim()) pieces.push(buf.trim());
  if (pieces.length === 0 && text.trim()) pieces.push(text.trim());

  return pieces.map((t, index) => ({ id: `chunk_${index}`, index, text: t }));
}

/** Light normalization — never mutates the immutable original. */
function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t\f]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------- pipeline stages ----------

interface PipelineContext {
  sourceId: string;
  /** Immutable original as stored on the source. */
  originalText: string;
  /** Normalized working text used by downstream stages. */
  text: string;
}

interface PipelineStage {
  name: string;
  run(ctx: PipelineContext): Promise<void>;
}

const normalizeStage: PipelineStage = {
  name: "normalization",
  async run(ctx) {
    ctx.text = normalize(ctx.originalText);
  },
};

const chunkStage: PipelineStage = {
  name: "chunking",
  async run(ctx) {
    setProcessingState(ctx.sourceId, "chunking");
    patchSource(ctx.sourceId, { chunks: chunkText(ctx.text) });
  },
};

const metadataStage: PipelineStage = {
  name: "metadata",
  async run() {
    // Metadata (title/author/origin/type) is captured at ingestion. This is
    // the seam for future derived metadata (word count, language, etc.) —
    // intentionally a no-op today to avoid storage churn and cost.
  },
};

const summaryStage: PipelineStage = {
  name: "summary",
  async run(ctx) {
    setProcessingState(ctx.sourceId, "summarizing");
    const { result, source } = await summarize(ctx.text.slice(0, MAX_MODEL_CHARS));
    patchSource(ctx.sourceId, { summary: result, derivedSource: source });
  },
};

const quotesStage: PipelineStage = {
  name: "quotes",
  async run(ctx) {
    setProcessingState(ctx.sourceId, "extracting_quotes");
    const { result } = await extractQuotes(ctx.text.slice(0, MAX_MODEL_CHARS));
    patchSource(ctx.sourceId, { keyQuotes: result });
  },
};

const conceptsStage: PipelineStage = {
  name: "concepts",
  async run(ctx) {
    setProcessingState(ctx.sourceId, "extracting_concepts");
    const { result } = await extractConcepts(ctx.text.slice(0, MAX_MODEL_CHARS));
    patchSource(ctx.sourceId, { keyConcepts: result });
  },
};

const beliefCandidatesStage: PipelineStage = {
  name: "belief-candidates",
  async run(ctx) {
    setProcessingState(ctx.sourceId, "generating_beliefs");
    const { result } = await generateBeliefs(ctx.text.slice(0, MAX_MODEL_CHARS));
    patchSource(ctx.sourceId, { candidateBeliefs: result.map((b) => b.claim) });
  },
};

/** Inactive seams — defined so the architecture is complete, but no-ops
 *  today (they'd add AI cost + UI surface; out of scope per LIFEOS-006). */
const questionsStage: PipelineStage = { name: "questions", async run() {} };
const relationshipsStage: PipelineStage = { name: "relationships", async run() {} };

/** The ordered pipeline. Replace/reorder/insert stages here — nothing else. */
export const PIPELINE_STAGES: PipelineStage[] = [
  normalizeStage,
  chunkStage,
  metadataStage,
  summaryStage,
  quotesStage,
  conceptsStage,
  beliefCandidatesStage,
  questionsStage,
  relationshipsStage,
];

/**
 * Run the full pipeline over a source's immutable original text. Safe to
 * call again to re-process.
 */
export async function processSource(sourceId: string, originalText: string): Promise<void> {
  const ctx: PipelineContext = { sourceId, originalText, text: originalText };
  try {
    for (const stage of PIPELINE_STAGES) {
      await stage.run(ctx);
    }
    setProcessingState(sourceId, "ready");
  } catch (e) {
    setProcessingState(sourceId, "error", e instanceof Error ? e.message : "processing failed");
  }
}
