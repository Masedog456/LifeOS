/**
 * Client helper for the single AI route (`/api/ai`). Every screen that
 * needs AI goes through here. If the network call fails entirely, it
 * falls back to the same deterministic mocks the route uses, so no
 * feature ever hard-depends on connectivity.
 */

import { mockProposals, type ProposalDraft } from "@/lib/proposals";
import {
  mockAnswer,
  mockConcepts,
  mockMapChunk,
  mockQuotes,
  mockReduceSummary,
  mockSummary,
  type ChunkMap,
} from "@/lib/mockAI";

export type AiSource = "ai" | "mock";
export type { ChunkMap } from "@/lib/mockAI";

async function call<T>(
  body: Record<string, unknown>,
  fallback: () => T,
): Promise<{ result: T; source: AiSource }> {
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("ai route failed");
    const data = (await res.json()) as { result: T; source: AiSource };
    return { result: data.result, source: data.source };
  } catch {
    return { result: fallback(), source: "mock" };
  }
}

export function generateBeliefs(text: string) {
  return call<ProposalDraft[]>({ task: "beliefs", text }, () => mockProposals(text));
}

export function summarize(text: string) {
  return call<string>({ task: "summary", text }, () => mockSummary(text));
}

export function extractQuotes(text: string) {
  return call<string[]>({ task: "quotes", text }, () => mockQuotes(text));
}

export function extractConcepts(text: string) {
  return call<string[]>({ task: "concepts", text }, () => mockConcepts(text));
}

export function askQuestion(text: string, question: string) {
  return call<string>({ task: "question", text, question }, () =>
    mockAnswer(text, question),
  );
}

// ---------- Long-source map/reduce (LIFEOS-007) ----------

/** Map one chunk → structured {summary, concepts, quotes(+spans), claims}. One AI call. */
export function mapChunk(text: string) {
  return call<ChunkMap>({ task: "map", text }, () => mockMapChunk(text));
}

/** Reduce many chunk summaries → one source-wide summary. One AI call. */
export function reduceSummary(summaries: string[]) {
  return call<string>({ task: "reduce_summary", summaries }, () =>
    mockReduceSummary(summaries),
  );
}
