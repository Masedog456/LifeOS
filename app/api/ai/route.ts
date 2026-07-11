/**
 * The SINGLE AI route for all of LifeOS.
 *
 * POST { task, text, question?, count? }
 *   task "beliefs"  -> { result: ProposalDraft[], source }
 *   task "summary"  -> { result: string, source }
 *   task "quotes"   -> { result: string[], source }
 *   task "concepts" -> { result: string[], source }
 *   task "question" -> { result: string, source }
 *
 * If ANTHROPIC_API_KEY is set, makes exactly one Anthropic call for the
 * task. Otherwise — or on any failure — returns deterministic mock output
 * so the product always works offline. This is the only route that talks
 * to a model: no background agents, roles, embeddings, or vector/graph
 * search anywhere in the system.
 */

import { NextResponse } from "next/server";
import { mockProposals, type ProposalDraft } from "@/lib/proposals";
import { mockAnswer, mockConcepts, mockQuotes, mockSummary } from "@/lib/mockAI";

type Task = "beliefs" | "summary" | "quotes" | "concepts" | "question";

interface AnthropicTextBlock {
  type: string;
  text?: string;
}
interface AnthropicResponse {
  content?: AnthropicTextBlock[];
}

function rawText(data: AnthropicResponse): string {
  return (data.content ?? [])
    .map((b) => (b.type === "text" ? (b.text ?? "") : ""))
    .join("")
    .trim();
}

function jsonSlice(raw: string, open: "[" | "{"): string {
  const close = open === "[" ? "]" : "}";
  const start = raw.indexOf(open);
  const end = raw.lastIndexOf(close);
  if (start < 0 || end <= start) throw new Error("no JSON in response");
  return raw.slice(start, end + 1);
}

function parseClaims(raw: string, text: string): ProposalDraft[] {
  const parsed = JSON.parse(jsonSlice(raw, "[")) as Array<{
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

function parseStringArray(raw: string): string[] {
  const parsed = JSON.parse(jsonSlice(raw, "[")) as unknown[];
  return parsed
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim())
    .slice(0, 8);
}

function promptFor(task: Task, text: string, question: string): string {
  const src = `Source text:\n"""\n${text.slice(0, 8000)}\n"""`;
  switch (task) {
    case "summary":
      return `Summarize the following in 2–4 sentences, plainly, no preamble.\n\n${src}`;
    case "quotes":
      return `Extract up to 5 of the most important VERBATIM quotes from the text. Return ONLY a JSON array of strings, each an exact substring.\n\n${src}`;
    case "concepts":
      return `Identify up to 5 key concepts (1–3 words each) in the text. Return ONLY a JSON array of strings.\n\n${src}`;
    case "question":
      return `Answer the user's question using ONLY the source text. If the text doesn't say, say so. Be concise.\n\nQuestion: ${question}\n\n${src}`;
    case "beliefs":
    default:
      return [
        "From the text, propose 1–3 belief claims in first person",
        '("I believe…", "I want to…"), each grounded in an exact span.',
        "Return ONLY a JSON array of objects with keys:",
        '  "claim" (string), "theme" (string, 1–2 words), "span" (exact substring).',
        "",
        src,
      ].join("\n");
  }
}

function mockFor(task: Task, text: string, question: string): unknown {
  switch (task) {
    case "summary":
      return mockSummary(text);
    case "quotes":
      return mockQuotes(text);
    case "concepts":
      return mockConcepts(text);
    case "question":
      return mockAnswer(text, question);
    case "beliefs":
    default:
      return mockProposals(text);
  }
}

function parseFor(task: Task, raw: string, text: string): unknown {
  switch (task) {
    case "summary":
    case "question":
      return raw;
    case "quotes":
    case "concepts":
      return parseStringArray(raw);
    case "beliefs":
    default: {
      const claims = parseClaims(raw, text);
      if (claims.length === 0) throw new Error("empty proposals");
      return claims;
    }
  }
}

export async function POST(request: Request) {
  let task: Task = "beliefs";
  let text = "";
  let question = "";
  try {
    const body = (await request.json()) as {
      task?: Task;
      text?: string;
      question?: string;
    };
    task = body.task ?? "beliefs";
    text = (body.text ?? "").trim();
    question = (body.question ?? "").trim();
  } catch {
    return NextResponse.json({ result: mockFor("beliefs", "", ""), source: "mock" });
  }

  if (!text) {
    return NextResponse.json({ result: mockFor(task, "", question), source: "mock" });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ result: mockFor(task, text, question), source: "mock" });
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
        messages: [{ role: "user", content: promptFor(task, text, question) }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = (await res.json()) as AnthropicResponse;
    return NextResponse.json({ result: parseFor(task, rawText(data), text), source: "ai" });
  } catch {
    return NextResponse.json({ result: mockFor(task, text, question), source: "mock" });
  }
}
