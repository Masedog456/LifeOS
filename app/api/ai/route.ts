/**
 * The SINGLE AI route for all of LifeOS.
 *
 * POST { task, text?, question?, summaries? }
 *   task "beliefs"        -> { result: ProposalDraft[], source }
 *   task "summary"        -> { result: string, source }
 *   task "quotes"         -> { result: string[], source }
 *   task "concepts"       -> { result: string[], source }
 *   task "question"       -> { result: string, source }
 *   task "map"            -> { result: ChunkMap, source }        (one chunk → structured)
 *   task "reduce_summary" -> { result: string, source }          (chunk summaries → one)
 *
 * If ANTHROPIC_API_KEY is set, makes exactly one Anthropic call for the
 * task. Otherwise — or on any failure — returns deterministic mock output
 * so the product always works offline. This is the only route that talks to
 * a model. Source text and keys are never logged.
 */

import { NextResponse } from "next/server";
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
import { mockCompare } from "@/lib/mockCompare";

export const maxDuration = 30;
export const runtime = "nodejs";

type Task =
  | "beliefs"
  | "summary"
  | "quotes"
  | "concepts"
  | "question"
  | "map"
  | "reduce_summary"
  | "compare"
  | "compare_verify";

const ALLOWED_TASKS = new Set<Task>([
  "beliefs",
  "summary",
  "quotes",
  "concepts",
  "question",
  "map",
  "reduce_summary",
  "compare",
  "compare_verify",
]);

const MAX_INPUT_CHARS = 50_000;
const MAX_MODEL_CHARS = 12_000;
const MAX_SUMMARIES = 60;
const MAX_EVIDENCE = 60;
const REQUEST_TIMEOUT_MS = 25_000;

/** A lightweight evidence item as received by the compare task. */
interface CompareEvidence {
  id: string;
  group: string;
  kind: string;
  text: string;
  page?: number;
}

interface AnthropicTextBlock {
  type: string;
  text?: string;
}
interface AnthropicResponse {
  content?: AnthropicTextBlock[];
}

interface AiInput {
  task: Task;
  text: string;
  question: string;
  summaries: string[];
  // ---- comparison (LIFEOS-010) ----
  evidence: CompareEvidence[];
  title: string;
  sourcesCompared: string[];
  coverageNote: string;
  /** The draft comparison result to review (compare_verify only). */
  draft: string;
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

/** Parse a map result and verify quotes are exact substrings of the chunk text. */
function parseMap(raw: string, text: string): ChunkMap {
  const obj = JSON.parse(jsonSlice(raw, "{")) as {
    summary?: unknown;
    concepts?: unknown;
    quotes?: unknown;
    claims?: unknown;
  };
  const strArr = (v: unknown, n: number) =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
          .slice(0, n)
      : [];
  const quotes = (Array.isArray(obj.quotes) ? obj.quotes : [])
    .map((q) => (typeof q === "string" ? q : (q as { text?: string })?.text))
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.trim())
    .map((t) => {
      const start = text.indexOf(t);
      return start < 0 ? null : { text: t, start, end: start + t.length };
    })
    .filter((q): q is { text: string; start: number; end: number } => q !== null)
    .slice(0, 6);
  return {
    summary: typeof obj.summary === "string" ? obj.summary.trim() : "",
    concepts: strArr(obj.concepts, 6),
    quotes,
    claims: strArr(obj.claims, 4),
  };
}

function evidenceBlock(evidence: CompareEvidence[]): string {
  return evidence
    .map((e) => {
      const prov = [e.group, e.kind, e.page != null ? `p.${e.page}` : ""].filter(Boolean).join("; ");
      return `[${e.id}] (${prov}) "${e.text.replace(/\s+/g, " ").slice(0, 600)}"`;
    })
    .join("\n");
}

function comparePrompt(input: AiInput): string {
  return [
    "You are comparing 2–5 intellectual materials for a single reader.",
    "Use ONLY the evidence items below, and cite them by id (e.g. E1, E4).",
    "",
    "RULES:",
    "- Every agreement, disagreement, assumption, unresolved tension,",
    "  relation-to-belief, and strongest-evidence entry MUST cite one or more",
    "  evidence ids that appear below. NEVER cite an id that is not listed, and",
    "  never state a conclusion you cannot ground in the evidence.",
    "- Do NOT invent quotes, claims, or facts absent from the evidence.",
    "- Preserve genuine differences. Do NOT declare distinct traditions",
    "  identical or interchangeable. Use cautious language: \"resembles\",",
    "  \"may parallel\", \"differs because\", \"under this interpretation\".",
    "- Classify each disagreement's \"kind\" as exactly one of: logical,",
    "  practical, definitional, level_of_analysis, historical, ambiguity.",
    "  Not every difference is a contradiction.",
    "",
    "Return ONLY a JSON object with keys: title (string), question (string),",
    "sourcesCompared (string[]), sharedConcepts (string[]),",
    "agreements ({statement, evidenceIds[]}[]),",
    "disagreements ({statement, kind, evidenceIds[]}[]),",
    "terminologyDifferences ({term, note, evidenceIds[]}[]),",
    "assumptions ({statement, evidenceIds[]}[]),",
    "strongestEvidence ({position, evidenceIds[]}[]),",
    "unresolvedTensions ({statement, evidenceIds[]}[]),",
    "questionsForUser (string[]),",
    "relationToBeliefs ({statement, evidenceIds[]}[]),",
    "limitations (string[]), coverageNote (string).",
    "",
    `Question: ${input.question || "Where do these sources agree, disagree, and use terms differently?"}`,
    `Coverage note: ${input.coverageNote}`,
    "",
    "Evidence:",
    evidenceBlock(input.evidence),
  ].join("\n");
}

function verifyPrompt(input: AiInput): string {
  return [
    "Review this DRAFT comparison for problems. Return ONLY a JSON object:",
    '  { "cautions": string[], "removeStatements": string[] }',
    "- cautions: brief warnings about false equivalence, overreach, flattened",
    "  distinctions, or conclusions stronger than the evidence supports.",
    "- removeStatements: EXACT statement strings from the draft that are not",
    "  supported by the listed evidence and should be removed.",
    "Valid evidence ids: " + input.evidence.map((e) => e.id).join(", "),
    "",
    "Evidence:",
    evidenceBlock(input.evidence),
    "",
    "Draft comparison JSON:",
    input.draft.slice(0, MAX_MODEL_CHARS),
  ].join("\n");
}

function promptFor(input: AiInput): string {
  const src = `Source text:\n"""\n${input.text.slice(0, MAX_MODEL_CHARS)}\n"""`;
  switch (input.task) {
    case "compare":
      return comparePrompt(input);
    case "compare_verify":
      return verifyPrompt(input);
    case "summary":
      return `Summarize the following in 2–4 sentences, plainly, no preamble.\n\n${src}`;
    case "quotes":
      return `Extract up to 5 of the most important VERBATIM quotes from the text. Return ONLY a JSON array of strings, each an exact substring.\n\n${src}`;
    case "concepts":
      return `Identify up to 5 key concepts (1–3 words each) in the text. Return ONLY a JSON array of strings.\n\n${src}`;
    case "question":
      return `Answer the user's question using ONLY the source text. If the text doesn't say, say so. Be concise.\n\nQuestion: ${input.question}\n\n${src}`;
    case "map":
      return [
        "Analyze ONE chunk of a longer source. Return ONLY a JSON object:",
        '  { "summary": string (1–2 sentences),',
        '    "concepts": string[] (up to 5, 1–3 words each),',
        '    "quotes": string[] (up to 4 EXACT verbatim substrings of the chunk),',
        '    "claims": string[] (0–3 first-person belief claims, ONLY if strongly supported) }',
        "Do not invent quotes or claims not present in the chunk.",
        "",
        src,
      ].join("\n");
    case "reduce_summary":
      return [
        "Combine these chunk summaries into ONE coherent summary of the whole",
        "source (3–6 sentences). Use only what the summaries state; add nothing.",
        "",
        input.summaries.map((s, i) => `[chunk ${i + 1}] ${s}`).join("\n"),
      ].join("\n");
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

function mockFor(input: AiInput): unknown {
  switch (input.task) {
    case "summary":
      return mockSummary(input.text);
    case "quotes":
      return mockQuotes(input.text);
    case "concepts":
      return mockConcepts(input.text);
    case "question":
      return mockAnswer(input.text, input.question);
    case "map":
      return mockMapChunk(input.text);
    case "reduce_summary":
      return mockReduceSummary(input.summaries);
    case "compare":
      return mockCompare({
        evidence: input.evidence,
        question: input.question,
        title: input.title || "Comparison",
        sourcesCompared: input.sourcesCompared,
        coverageNote: input.coverageNote,
      });
    case "compare_verify":
      return { cautions: [], removeStatements: [] };
    case "beliefs":
    default:
      return mockProposals(input.text);
  }
}

function parseFor(input: AiInput, raw: string): unknown {
  switch (input.task) {
    case "summary":
    case "question":
    case "reduce_summary":
      return raw;
    case "quotes":
    case "concepts":
      return parseStringArray(raw);
    case "map":
      return parseMap(raw, input.text);
    case "compare":
    case "compare_verify":
      // Return the raw parsed object; strict validation happens client-side
      // (lib/comparison) where the full evidence set is available.
      return JSON.parse(jsonSlice(raw, "{"));
    case "beliefs":
    default: {
      const claims = parseClaims(raw, input.text);
      if (claims.length === 0) throw new Error("empty proposals");
      return claims;
    }
  }
}

function maxTokensFor(task: Task): number {
  // Comparison output is a large structured object; give it more room.
  return task === "compare" ? 3072 : task === "compare_verify" ? 1024 : 1024;
}

async function callAnthropic(key: string, input: AiInput): Promise<unknown> {
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokensFor(input.task),
        messages: [{ role: "user", content: promptFor(input) }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`anthropic_${res.status}`);
    const data = (await res.json()) as AnthropicResponse;
    return parseFor(input, rawText(data));
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  let input: AiInput;
  try {
    const body = (await request.json()) as {
      task?: unknown;
      text?: unknown;
      question?: unknown;
      summaries?: unknown;
      evidence?: unknown;
      title?: unknown;
      sourcesCompared?: unknown;
      coverageNote?: unknown;
      draft?: unknown;
    };
    const t = typeof body.task === "string" ? (body.task as Task) : "beliefs";
    if (!ALLOWED_TASKS.has(t)) {
      return NextResponse.json({ error: "invalid task" }, { status: 400 });
    }
    input = {
      task: t,
      text: (typeof body.text === "string" ? body.text : "").slice(0, MAX_INPUT_CHARS).trim(),
      question: (typeof body.question === "string" ? body.question : "").slice(0, 2_000).trim(),
      summaries: Array.isArray(body.summaries)
        ? body.summaries
            .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
            .map((s) => s.trim())
            .slice(0, MAX_SUMMARIES)
        : [],
      evidence: Array.isArray(body.evidence)
        ? body.evidence
            .filter(
              (e): e is CompareEvidence =>
                !!e && typeof (e as CompareEvidence).id === "string" && typeof (e as CompareEvidence).text === "string",
            )
            .map((e) => ({
              id: String(e.id).slice(0, 12),
              group: String(e.group ?? "").slice(0, 200),
              kind: String(e.kind ?? "").slice(0, 40),
              text: String(e.text).slice(0, 2_000),
              page: typeof e.page === "number" ? e.page : undefined,
            }))
            .slice(0, MAX_EVIDENCE)
        : [],
      title: (typeof body.title === "string" ? body.title : "").slice(0, 300).trim(),
      sourcesCompared: Array.isArray(body.sourcesCompared)
        ? body.sourcesCompared.filter((s): s is string => typeof s === "string").map((s) => s.trim()).slice(0, 5)
        : [],
      coverageNote: (typeof body.coverageNote === "string" ? body.coverageNote : "").slice(0, 500).trim(),
      draft: (typeof body.draft === "string" ? body.draft : "").slice(0, MAX_INPUT_CHARS),
    };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const hasInput =
    input.task === "reduce_summary"
      ? input.summaries.length > 0
      : input.task === "compare" || input.task === "compare_verify"
        ? input.evidence.length > 0
        : input.text.length > 0;
  if (!hasInput) {
    return NextResponse.json({ result: mockFor(input), source: "mock" });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ result: mockFor(input), source: "mock" });
  }

  try {
    const result = await callAnthropic(key, input);
    return NextResponse.json({ result, source: "ai" });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown";
    console.error(`[ai] task=${input.task} failed: ${reason}; serving mock`);
    return NextResponse.json({ result: mockFor(input), source: "mock", degraded: true });
  }
}
