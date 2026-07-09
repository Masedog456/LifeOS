/**
 * The single AI call in the LIFEOS-002 MVP.
 *
 * POST { text } -> { proposals: ProposalDraft[], source: "ai" | "mock" }
 *
 * If ANTHROPIC_API_KEY is set, makes exactly one Anthropic call to
 * propose 1–3 first-person belief claims tied to text spans. Otherwise —
 * or if the call fails for any reason — returns deterministic mock
 * proposals so the product always works. There are no background agents,
 * roles, embeddings, or vector/graph search.
 */

import { NextResponse } from "next/server";
import { mockProposals, type ProposalDraft } from "@/lib/proposals";

interface AnthropicTextBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicTextBlock[];
}

function buildPrompt(text: string): string {
  return [
    "You help a single user turn something they read or thought into 1–3",
    "belief claims stated in first person (\"I believe…\", \"I want to…\").",
    "Each claim must be grounded in an exact span of the user's text.",
    "",
    "Return ONLY a JSON array (no prose) of up to 3 objects with keys:",
    '  "claim"  (string, first-person),',
    '  "theme"  (string, 1–2 words),',
    '  "span"   (string, the exact substring of the input that inspired it).',
    "",
    "User text:",
    '"""',
    text,
    '"""',
  ].join("\n");
}

function parseClaims(data: AnthropicResponse, text: string): ProposalDraft[] {
  const raw = (data.content ?? [])
    .map((b) => (b.type === "text" ? (b.text ?? "") : ""))
    .join("")
    .trim();

  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("no JSON array in response");

  const parsed = JSON.parse(raw.slice(start, end + 1)) as Array<{
    claim?: string;
    theme?: string;
    span?: string;
  }>;

  return parsed
    .filter((p) => typeof p.claim === "string" && p.claim.trim().length > 0)
    .slice(0, 3)
    .map((p) => {
      const spanStart = p.span ? text.indexOf(p.span) : -1;
      return {
        claim: p.claim!.trim(),
        theme: p.theme?.trim() || undefined,
        spanStart: spanStart < 0 ? undefined : spanStart,
        spanEnd: spanStart < 0 || !p.span ? undefined : spanStart + p.span.length,
      };
    });
}

export async function POST(request: Request) {
  let text = "";
  try {
    const body = (await request.json()) as { text?: string };
    text = (body.text ?? "").trim();
  } catch {
    return NextResponse.json({ proposals: [], source: "mock" });
  }

  if (!text) return NextResponse.json({ proposals: [], source: "mock" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ proposals: mockProposals(text), source: "mock" });
  }

  try {
    const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: "user", content: buildPrompt(text) }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = (await res.json()) as AnthropicResponse;
    const proposals = parseClaims(data, text);
    if (proposals.length === 0) throw new Error("empty proposals");
    return NextResponse.json({ proposals, source: "ai" });
  } catch {
    // Any failure → deterministic mock, so capture/review never breaks.
    return NextResponse.json({ proposals: mockProposals(text), source: "mock" });
  }
}
