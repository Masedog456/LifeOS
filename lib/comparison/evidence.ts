/**
 * Deterministic evidence packet for comparison (LIFEOS-010, Phase 3).
 *
 * Built entirely from data already in the store — nothing is fabricated and
 * no AI is called here. Every item keeps provenance (source/chunk id, page
 * or offsets, exact quote text, AI/mock origin) so the comparison result can
 * cite it. Whole sources are NOT sent: per-source caps + a total-size cap
 * keep the packet small, and the LIFEOS-009 retrieval layer ranks which
 * quotes/passages are most relevant to the comparison question.
 */

import type {
  ComparisonInputRef,
  Coverage,
  EvidenceGroup,
  EvidenceItem,
  KnowledgeSource,
  StoreState,
} from "@/types/mvp";
import { buildRecords } from "@/lib/retrieval/records";
import { search } from "@/lib/retrieval/search";

// Per-source caps (Phase 3 / Phase 5 evidence-size cap).
const MAX_CONCEPTS = 6;
const MAX_QUOTES = 4;
const MAX_CHUNK_SUMMARIES = 3;
const MAX_CLAIMS = 3;
/** Approximate char budget for the whole packet sent to the model. */
export const MAX_PACKET_CHARS = 12_000;

function pageForOffset(source: KnowledgeSource, offset: number): number | undefined {
  return source.pageMap?.find((p) => offset >= p.start && offset < p.end)?.page;
}

function isPartial(source: KnowledgeSource): boolean {
  const cov = source.analysis?.coverage;
  return (
    cov === "sampled" ||
    source.extractionStatus === "partial_text" ||
    source.extractionStatus === "scanned_ocr_required" ||
    source.processingState === "partial"
  );
}

/**
 * Rank a source's quotes/chunk-summaries by relevance to the question using
 * the deterministic retrieval engine. Falls back to source order when there
 * is no question. Returns a predicate-free ordering (most relevant first).
 */
function relevanceOrder(
  state: StoreState,
  sourceId: string,
  question: string,
): (a: string, b: string) => number {
  if (!question.trim()) return () => 0;
  const records = buildRecords(state).filter((r) => r.sourceId === sourceId);
  const ranked = search(question, records, state.feedback, { limit: 50, maxPerSource: 50 });
  const rank = new Map<string, number>();
  ranked.forEach((r, i) => rank.set(r.record.text, i));
  return (a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999);
}

function sourceGroup(
  state: StoreState,
  source: KnowledgeSource,
  ref: ComparisonInputRef,
  question: string,
  seq: () => string,
): EvidenceGroup {
  const items: EvidenceItem[] = [];
  const origin = source.derivedSource;
  const label = ref.label;
  const order = relevanceOrder(state, source.id, question);

  items.push({
    id: seq(),
    kind: "metadata",
    group: label,
    sourceId: source.id,
    text: [source.title, source.author].filter(Boolean).join(" — ") || source.title,
    origin,
  });

  if (source.summary) {
    items.push({
      id: seq(),
      kind: "summary",
      group: label,
      sourceId: source.id,
      text: source.summary,
      origin,
    });
  }

  // Representative chunk summaries (long-source coverage), most-relevant first.
  const chunkSummaries = (source.chunkResults ?? [])
    .filter((c) => c.summary)
    .sort((a, b) => order(a.summary, b.summary))
    .slice(0, MAX_CHUNK_SUMMARIES);
  for (const c of chunkSummaries) {
    items.push({
      id: seq(),
      kind: "chunk_summary",
      group: label,
      sourceId: source.id,
      chunkId: c.chunkId,
      text: c.summary,
      origin: c.source,
    });
  }

  // Exact quotes with page provenance, most-relevant first.
  const quotes = [...source.keyQuotes].sort(order).slice(0, MAX_QUOTES);
  for (const q of quotes) {
    const off = source.originalText.indexOf(q);
    items.push({
      id: seq(),
      kind: "quote",
      group: label,
      sourceId: source.id,
      page: off >= 0 ? pageForOffset(source, off) : undefined,
      start: off >= 0 ? off : undefined,
      end: off >= 0 ? off + q.length : undefined,
      text: q,
      origin,
    });
  }

  for (const c of source.keyConcepts.slice(0, MAX_CONCEPTS)) {
    items.push({ id: seq(), kind: "concept", group: label, sourceId: source.id, text: c, origin });
  }

  for (const cb of source.candidateBeliefs.slice(0, MAX_CLAIMS)) {
    items.push({ id: seq(), kind: "claim", group: label, sourceId: source.id, text: cb, origin });
  }

  return {
    ref,
    coverage: source.analysis?.coverage ?? null,
    partial: isPartial(source),
    items,
  };
}

/**
 * Build the evidence packet for the selected inputs. Returns grouped
 * evidence (for display + coverage) and a flat, id-stable list (for the AI
 * prompt and result validation).
 */
export function buildEvidence(
  state: StoreState,
  inputs: ComparisonInputRef[],
  question: string,
): { groups: EvidenceGroup[]; flat: EvidenceItem[] } {
  let n = 0;
  const seq = () => `E${++n}`;
  const groups: EvidenceGroup[] = [];

  for (const ref of inputs) {
    if (ref.kind === "belief" && ref.beliefId) {
      const belief = state.beliefs.find((b) => b.id === ref.beliefId);
      if (!belief) continue;
      groups.push({
        ref,
        coverage: null,
        partial: false,
        items: [
          {
            id: seq(),
            kind: "belief",
            group: ref.label,
            beliefId: belief.id,
            text: belief.text,
          },
        ],
      });
    } else if (ref.kind === "passage" && ref.quote) {
      groups.push({
        ref,
        coverage: null,
        partial: false,
        items: [
          {
            id: seq(),
            kind: "quote",
            group: ref.label,
            sourceId: ref.sourceId,
            page: ref.page,
            text: ref.quote,
          },
        ],
      });
    } else if (ref.sourceId) {
      const source = state.sources.find((s) => s.id === ref.sourceId);
      if (!source) continue;
      groups.push(sourceGroup(state, source, ref, question, seq));
    }
  }

  // Total-size cap: trim from the end (lowest-priority items) if oversized.
  let flat = groups.flatMap((g) => g.items);
  let total = flat.reduce((sum, it) => sum + it.text.length, 0);
  while (total > MAX_PACKET_CHARS && flat.length > inputs.length) {
    const removed = flat.pop()!;
    total -= removed.text.length;
    for (const g of groups) g.items = g.items.filter((it) => it !== removed);
  }
  flat = groups.flatMap((g) => g.items);

  return { groups, flat };
}

/** Coverage summary across all groups (Phase 4 coverageNote / warnings). */
export function coverageSummary(groups: EvidenceGroup[]): {
  coverage: Coverage | null;
  partial: boolean;
  note: string;
} {
  const partial = groups.some((g) => g.partial);
  const anyFull = groups.some((g) => g.coverage === "full");
  const coverage: Coverage | null = partial ? "sampled" : anyFull ? "full" : null;
  const partialLabels = groups.filter((g) => g.partial).map((g) => g.ref.label);
  const note = partial
    ? `Partial coverage: ${partialLabels.join(", ")} ${
        partialLabels.length === 1 ? "was" : "were"
      } only partly analyzed or extracted. Treat conclusions as provisional.`
    : "All selected materials were fully analyzed within their processing limits.";
  return { coverage, partial, note };
}
