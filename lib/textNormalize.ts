/**
 * The one text normalizer, shared by PDF extraction and the pipeline so
 * that char offsets (page map, chunk offsets, quote spans) all agree.
 * Conservative + idempotent: normalizeText(normalizeText(x)) === normalizeText(x).
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t\f]+$/g, "").replace(/[ \t\f]{2,}/g, " "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
