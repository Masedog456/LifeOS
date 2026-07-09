/**
 * Deterministic mock proposal generation for the LIFEOS-002 MVP.
 *
 * When no Anthropic key is configured (or a real call fails), the app
 * falls back to these deterministic proposals so the capture → review →
 * belief loop always works. Given the same capture text, this always
 * produces the same proposals.
 *
 * This is the ONLY proposal logic in the MVP. There are no background
 * agents, no named AI roles, no embeddings, no vector/graph search.
 */

export interface ProposalDraft {
  claim: string;
  theme?: string;
  spanStart?: number;
  spanEnd?: number;
}

function lowerFirst(s: string): string {
  if (!s) return s;
  // Don't lowercase a leading standalone "I" (e.g. "I want to be present").
  if (s === "I" || s.startsWith("I ") || s.startsWith("I'")) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function themeOf(sentence: string): string {
  const words = sentence
    .replace(/[^a-zA-Z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4);
  if (words.length === 0) return "Reflections";
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a));
  return longest.charAt(0).toUpperCase() + longest.slice(1).toLowerCase();
}

/**
 * Split into sentence-ish candidates, pick up to 3 substantive ones, and
 * turn each into a first-person belief claim tied to its text span.
 */
export function mockProposals(text: string): ProposalDraft[] {
  const clean = text.trim();
  if (!clean) return [];

  const sentences = clean
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const substantive = sentences.filter((s) => s.length >= 12);
  const chosen = (substantive.length > 0 ? substantive : [clean]).slice(0, 3);

  return chosen.map((s) => {
    const spanStart = text.indexOf(s);
    const body = s.replace(/[.!?]+$/, "");
    return {
      claim: `I believe ${lowerFirst(body)}.`,
      theme: themeOf(s),
      spanStart: spanStart < 0 ? undefined : spanStart,
      spanEnd: spanStart < 0 ? undefined : spanStart + s.length,
    };
  });
}
