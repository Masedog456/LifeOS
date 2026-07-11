/**
 * Client helper for the single AI route (`/api/ai`). Every screen that
 * needs AI goes through here. If the network call fails entirely, it
 * falls back to the same deterministic mocks the route uses, so no
 * feature ever hard-depends on connectivity.
 */

import { mockProposals, type ProposalDraft } from "@/lib/proposals";
import { mockAnswer, mockConcepts, mockQuotes, mockSummary } from "@/lib/mockAI";

export type AiSource = "ai" | "mock";

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
