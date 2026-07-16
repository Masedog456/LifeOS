/**
 * Deterministic decision evidence (LIFEOS-016, Phase 5).
 *
 * Builds a capped, provenance-bearing packet from the user's own records —
 * beliefs, reflections, practices, sources (+ key quotes inline), comparisons,
 * inquiries, Megathreads, reasoning results, and earlier decisions — ranked by
 * lexical overlap plus (when the user has built a semantic index) local
 * semantic similarity. Evidence ids ARE real record ids so citations validate
 * and freshness fingerprints resolve. Never sends the whole library; never
 * infers personal facts from missing data.
 */

import type { Decision, EvidenceItem, StoreState } from "@/types/mvp";
import { cosine, localEmbed } from "@/lib/embeddings/local";
import { hasSemanticIndex } from "@/lib/retrieval/semantic";

export const MAX_DECISION_EVIDENCE = 40;

const STOP = new Set([
  "the", "and", "for", "are", "but", "not", "you", "that", "this", "with", "from", "have",
  "what", "your", "they", "them", "into", "when", "will", "would", "there", "their", "about",
  "which", "were", "been", "some", "such", "should", "could", "than", "then",
]);

function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t)));
}

/** The text a decision is "about": question + options + criteria + constraints. */
export function decisionText(d: Decision): string {
  return [
    d.title,
    d.question,
    ...d.options.map((o) => `${o.name} ${o.description ?? ""}`),
    ...d.criteria.map((c) => c.name),
    ...d.constraints,
    ...d.assumptions,
  ].join(" · ");
}

interface Candidate {
  id: string;
  kind: EvidenceItem["kind"];
  group: string;
  text: string;
  score: number;
}

export function buildDecisionEvidence(state: StoreState, d: Decision): EvidenceItem[] {
  const qText = decisionText(d);
  const qTokens = tokens(qText);
  const semantic = hasSemanticIndex(state);
  const qVec = semantic ? localEmbed(qText) : null;
  const seeds = new Set(d.seedRefs);

  const score = (text: string): number => {
    const t = tokens(text);
    let overlap = 0;
    for (const w of qTokens) if (t.has(w)) overlap++;
    const lex = qTokens.size ? overlap / qTokens.size : 0;
    const sim = qVec ? cosine(localEmbed(text), qVec) : 0;
    return lex * 3 + sim * 2;
  };

  const add = (id: string, kind: EvidenceItem["kind"], group: string, text: string, topN: { pool: Candidate[] }) => {
    const s = seeds.has(id) ? 999 : score(text); // seeds are always included
    if (s <= 0.05 && !seeds.has(id)) return;
    topN.pool.push({ id, kind, group, text, score: s });
  };

  const pools: Record<string, { pool: Candidate[]; cap: number }> = {
    beliefs: { pool: [], cap: 8 },
    reflections: { pool: [], cap: 4 },
    practices: { pool: [], cap: 3 },
    sources: { pool: [], cap: 5 },
    comparisons: { pool: [], cap: 3 },
    inquiries: { pool: [], cap: 3 },
    threads: { pool: [], cap: 3 },
    reasonings: { pool: [], cap: 2 },
    decisions: { pool: [], cap: 2 },
  };

  for (const b of state.beliefs) {
    if (b.status === "rejected") continue;
    add(b.id, "belief", b.status === "questioned" ? "Belief you questioned" : "Belief you hold", `${b.text} (${b.status})`, pools.beliefs);
  }
  for (const r of state.reflections) add(r.id, "belief", "Your reflection", r.response.slice(0, 220), pools.reflections);
  for (const p of state.practices) {
    if (p.status !== "accepted") continue;
    add(p.id, "claim", "Practice you accepted", p.userWording || p.title, pools.practices);
  }
  for (const s of state.sources) {
    const quote = (s.keyQuotes ?? [])[0];
    add(s.id, "metadata", "Source", [s.title, s.summary, quote ? `“${quote}”` : ""].filter(Boolean).join(" — ").slice(0, 320), pools.sources);
  }
  for (const c of state.comparisons) add(c.id, "comparison_finding", "Comparison", `${c.title}: ${c.question}`, pools.comparisons);
  for (const i of state.inquiries) add(i.id, "comparison_finding", "Inquiry", `${i.question} (${i.status})`, pools.inquiries);
  for (const t of state.megathreads) add(t.id, "metadata", "Thread", `${t.title}. ${t.synthesis?.currentUnderstanding ?? t.description ?? ""}`.slice(0, 280), pools.threads);
  for (const q of state.reasonings) add(q.id, "comparison_finding", "Reasoning", `${q.question} (${q.mode})`, pools.reasonings);
  for (const pd of state.decisions) {
    if (pd.id === d.id) continue;
    const chosen = pd.finalChoice ? pd.options.find((o) => o.id === pd.finalChoice)?.name : undefined;
    add(pd.id, "claim", "Earlier decision", `${pd.title}: ${pd.question}${chosen ? ` — you chose “${chosen}”` : ""}${pd.rationale ? `. Rationale: ${pd.rationale.slice(0, 140)}` : ""}`, pools.decisions);
  }

  let flat: EvidenceItem[] = [];
  for (const { pool, cap } of Object.values(pools)) {
    pool.sort((a, b) => b.score - a.score);
    for (const c of pool.slice(0, cap)) flat.push({ id: c.id, kind: c.kind, group: c.group, text: c.text });
  }
  // Global cap, seeds first.
  flat = [
    ...flat.filter((e) => seeds.has(e.id)),
    ...flat.filter((e) => !seeds.has(e.id)),
  ].slice(0, MAX_DECISION_EVIDENCE);

  // Dedup by id (a seed may appear in its pool too).
  const seen = new Set<string>();
  return flat.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}
