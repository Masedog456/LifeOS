/**
 * Extraction seam (LIFEOS-006). NOT an AI route — no model is called here.
 *
 *   POST { mode: "url", url }  -> { text, title, needsText } | { needsText, note }
 *   POST { mode: "pdf", ... }  -> { needsText, note }   (seam; auto-extraction TBD)
 *
 * URL extraction is dependency-free: fetch the page and reduce its HTML to
 * readable text. Anything it can't handle degrades to needsText so the
 * adapter falls back to a manual paste. This route is the single place a
 * real PDF parser or a better HTML extractor would later plug in.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 20;

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 3_000_000; // ~3MB of HTML
const MAX_TEXT = 100_000;
const MIN_ARTICLE_CHARS = 200;

/** Block non-http(s) and obvious private/loopback hosts (basic SSRF guard). */
function isSafeUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return null;
  }
  return u;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)));
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim() : undefined;
}

/** Reduce an HTML document to readable body text — no dependency. */
function htmlToText(html: string): string {
  const withoutHead = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  // Turn block boundaries into newlines so paragraphs survive.
  const blocked = withoutHead
    .replace(/<\/(p|div|section|article|h[1-6]|li|br|tr|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const text = decodeEntities(blocked.replace(/<[^>]+>/g, " "));
  return text
    .replace(/[ \t\f\r]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim()
    .slice(0, MAX_TEXT);
}

async function extractUrl(rawUrl: string) {
  const url = isSafeUrl(rawUrl);
  if (!url) {
    return { needsText: true, note: "That URL isn't fetchable — paste the article text instead." };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "LifeOS/1.0 (+ingestion)", accept: "text/html,*/*" },
    });
    if (!res.ok) {
      return { needsText: true, note: `Page returned ${res.status} — paste the text instead.` };
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      return { needsText: true, note: "That link isn't an HTML article — paste the text instead." };
    }
    const raw = (await res.text()).slice(0, MAX_BYTES);
    const text = htmlToText(raw);
    if (text.length < MIN_ARTICLE_CHARS) {
      return {
        needsText: true,
        note: "Couldn't read enough text (the page may be JavaScript-rendered) — paste it instead.",
      };
    }
    return { text, title: extractTitle(raw), needsText: false };
  } catch {
    return { needsText: true, note: "Couldn't fetch the page — paste the article text instead." };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  let mode = "";
  let url = "";
  try {
    const body = (await request.json()) as { mode?: string; url?: string };
    mode = body.mode ?? "";
    url = (body.url ?? "").trim();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (mode === "url") {
    if (!url) return NextResponse.json({ needsText: true, note: "No URL provided." });
    return NextResponse.json(await extractUrl(url));
  }

  if (mode === "pdf") {
    // Seam: automatic PDF extraction is not enabled (no fragile dependency).
    return NextResponse.json({
      needsText: true,
      note: "Automatic PDF extraction isn't enabled yet — paste the text in the reader.",
    });
  }

  return NextResponse.json({ error: "invalid mode" }, { status: 400 });
}
