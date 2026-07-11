/**
 * The knowledge processing pipeline (LIFEOS-003).
 *
 * Stages: capture → extract text → chunk → summary → quotes → concepts →
 * candidate belief claims. Each AI stage goes through the single AI route
 * (via lib/aiClient), and every stage's progress is written back to the
 * source so the Library UI can show live processing state. Candidate
 * beliefs are stored on the source only — they are NOT auto-pushed into
 * the Belief Inbox and never become Constitution entries automatically.
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
      // Very long paragraph: flush and split on sentences.
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

/**
 * Run the full pipeline over a source's immutable original text, writing
 * summary / key quotes / key concepts / candidate beliefs back to it.
 * Safe to call again to re-process.
 */
export async function processSource(sourceId: string, originalText: string): Promise<void> {
  try {
    setProcessingState(sourceId, "chunking");
    const chunks = chunkText(originalText);
    patchSource(sourceId, { chunks });

    // Bound what we send to the model; the mock ignores length anyway.
    const text = originalText.slice(0, 8000);

    setProcessingState(sourceId, "summarizing");
    const summary = await summarize(text);
    patchSource(sourceId, { summary: summary.result, derivedSource: summary.source });

    setProcessingState(sourceId, "extracting_quotes");
    const quotes = await extractQuotes(text);
    patchSource(sourceId, { keyQuotes: quotes.result });

    setProcessingState(sourceId, "extracting_concepts");
    const concepts = await extractConcepts(text);
    patchSource(sourceId, { keyConcepts: concepts.result });

    setProcessingState(sourceId, "generating_beliefs");
    const beliefs = await generateBeliefs(text);
    patchSource(sourceId, { candidateBeliefs: beliefs.result.map((b) => b.claim) });

    setProcessingState(sourceId, "ready");
  } catch (e) {
    setProcessingState(sourceId, "error", e instanceof Error ? e.message : "processing failed");
  }
}
