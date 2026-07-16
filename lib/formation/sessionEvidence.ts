/**
 * Deterministic formation-session evidence (LIFEOS-017, Phase 5).
 *
 * Builds a capped, provenance-bearing packet from the user's own records —
 * the reflection text itself, linked beliefs/decisions/threads/inquiries/
 * sources, and lexically-related beliefs, reflections, and sources. Evidence
 * ids ARE real record ids so citations validate and freshness fingerprints
 * resolve. Never sends the whole library; never infers unrecorded facts.
 */

import type { EvidenceItem, FormationSession, StoreState } from "@/types/mvp";
import { cosine, localEmbed } from "@/lib/embeddings/local";
import { hasSemanticIndex } from "@/lib/retrieval/semantic";

export const MAX_FORMATION_EVIDENCE = 40;

const STOP = new Set([
  "the", "and", "for", "are", "but", "not", "you", "that", "this", "with", "from", "have",
  "what", "your", "they", "them", "into", "when", "will", "would", "there", "their", "about",
  "which", "were", "been", "some", "such", "should", "could", "than", "then", "feel", "felt",
]);

function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t)));
}

/** The text a session is "about": prompt + reflection + structured capture. */
export function sessionText(s: FormationSession): string {
  return [
    s.title,
    s.prompt,
    s.reflection,
    ...s.lessons,
    ...s.unresolvedQuestions,
    ...s.emotionalObservations,
    ...s.revisedAssumptions,
    ...s.beliefCandidates,
  ].join(" · ");
}

interface Candidate {
  id: string;
  kind: EvidenceItem["kind"];
  group: string;
  text: string;
  score: number;
}

export function buildFormationEvidence(state: StoreState, s: FormationSession): EvidenceItem[] {
  const qText = sessionText(s);
  const qTokens = tokens(qText);
  const semantic = hasSemanticIndex(state);
  const qVec = semantic && qTokens.size ? localEmbed(qText) : null;
  const seeds = new Set<string>([
    ...s.seedRefs,
    ...s.linkedBeliefs,
    ...s.linkedDecisions,
    ...s.linkedThreads,
    ...s.linkedInquiries,
    ...s.linkedSources,
    ...s.linkedReflections,
  ]);

  const score = (text: string): number => {
    if (!qTokens.size) return 0;
    const t = tokens(text);
    let overlap = 0;
    for (const w of qTokens) if (t.has(w)) overlap++;
    const lex = overlap / qTokens.size;
    const sim = qVec ? cosine(localEmbed(text), qVec) : 0;
    return lex * 3 + sim * 2;
  };

  const pools: Record<string, { pool: Candidate[]; cap: number }> = {
    beliefs: { pool: [], cap: 10 },
    reflections: { pool: [], cap: 5 },
    practices: { pool: [], cap: 3 },
    sources: { pool: [], cap: 5 },
    threads: { pool: [], cap: 3 },
    inquiries: { pool: [], cap: 3 },
    decisions: { pool: [], cap: 3 },
  };

  const add = (id: string, kind: EvidenceItem["kind"], group: string, text: string, target: { pool: Candidate[] }) => {
    const sc = seeds.has(id) ? 999 : score(text);
    if (sc <= 0.05 && !seeds.has(id)) return;
    target.pool.push({ id, kind, group, text, score: sc });
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
  for (const src of state.sources) {
    const quote = (src.keyQuotes ?? [])[0];
    add(src.id, "metadata", "Source", [src.title, src.summary, quote ? `“${quote}”` : ""].filter(Boolean).join(" — ").slice(0, 320), pools.sources);
  }
  for (const t of state.megathreads) add(t.id, "metadata", "Thread", `${t.title}. ${t.synthesis?.currentUnderstanding ?? t.description ?? ""}`.slice(0, 280), pools.threads);
  for (const i of state.inquiries) add(i.id, "comparison_finding", "Inquiry", `${i.question} (${i.status})`, pools.inquiries);
  for (const d of state.decisions) {
    const chosen = d.finalChoice ? d.options.find((o) => o.id === d.finalChoice)?.name : undefined;
    add(d.id, "claim", "Decision", `${d.title}: ${d.question}${chosen ? ` — you chose “${chosen}”` : ""}`, pools.decisions);
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
  ].slice(0, MAX_FORMATION_EVIDENCE);

  // Dedup by id (a seed may appear in its pool too).
  const seen = new Set<string>();
  return flat.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}
