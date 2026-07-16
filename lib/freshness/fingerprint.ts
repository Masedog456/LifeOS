/**
 * Evidence freshness (LIFEOS-015, Phase 7).
 *
 * A saved result (comparison / inquiry / thread synthesis / weekly review /
 * reasoning) records a deterministic fingerprint of the records it was built
 * from. Recomputing and diffing detects when the underlying knowledge changed.
 * Pure and offline — no AI, no embeddings required. Never mutates anything.
 */

import type {
  Comparison,
  FingerprintDep,
  FreshnessStatus,
  Inquiry,
  Megathread,
  ReasoningQuery,
  ReviewSession,
  SavedFingerprint,
  StoreState,
} from "@/types/mvp";
import { hashText } from "@/lib/hash";

/** Bump when the processing pipeline changes in a way that invalidates results. */
export const PIPELINE_VERSION = 1;

/** Infer a record's kind from its id across the store. */
function kindOf(state: StoreState, id: string): string {
  if (id.startsWith("decision-config:")) return "configuration";
  if (state.beliefs.some((b) => b.id === id)) return "belief";
  if (state.sources.some((s) => s.id === id)) return "source";
  if (state.comparisons.some((c) => c.id === id)) return "comparison";
  if (state.inquiries.some((i) => i.id === id)) return "inquiry";
  if (state.megathreads.some((t) => t.id === id)) return "megathread";
  if (state.captures.some((c) => c.id === id)) return "capture";
  if (state.reflections.some((r) => r.id === id)) return "reflection";
  if (state.reasonings.some((q) => q.id === id)) return "reasoning";
  if (state.practices.some((p) => p.id === id)) return "practice";
  if (state.decisions.some((d) => d.id === id)) return "decision";
  return "unknown";
}

/** Deterministic content hash of one record — changes when its material changes. */
export function hashOfRecordId(state: StoreState, id: string): string {
  const b = state.beliefs.find((x) => x.id === id);
  if (b) return hashText(`${b.text}|${b.status}|${b.revisions.length}|${b.updatedAt}`);
  const s = state.sources.find((x) => x.id === id);
  if (s) return hashText(`${s.addedAt}|${s.processingState}|${s.summary?.length ?? 0}|${(s.chunks ?? []).length}|${(s.keyQuotes ?? []).length}|${s.analysis?.updatedAt ?? ""}`);
  const c = state.comparisons.find((x) => x.id === id);
  if (c) return hashText(`${c.createdAt}|${c.judgments.length}|${c.result.agreements.length}|${c.result.disagreements.length}`);
  const i = state.inquiries.find((x) => x.id === id);
  if (i) return hashText(`${i.updatedAt}|${i.status}|${i.history.length}|${i.result.affirmativeCase.length}|${i.result.negativeCase.length}`);
  const t = state.megathreads.find((x) => x.id === id);
  if (t) return hashText(`${t.updatedAt}|${t.members.length}|${t.status}|${t.synthesis?.currentUnderstanding?.length ?? 0}`);
  const cap = state.captures.find((x) => x.id === id);
  if (cap) return hashText(`${cap.text}`);
  const r = state.reflections.find((x) => x.id === id);
  if (r) return hashText(`${r.response}|${r.annotations.length}`);
  const q = state.reasonings.find((x) => x.id === id);
  if (q) return hashText(`${q.updatedAt}|${q.status}|${q.history.length}`);
  const p = state.practices.find((x) => x.id === id);
  if (p) return hashText(`${p.status}|${p.userWording ?? p.title}|${p.history.length}`);
  // Decision-configuration dep: changes when options/criteria/weights change.
  if (id.startsWith("decision-config:")) {
    const d = state.decisions.find((x) => x.id === id.slice("decision-config:".length));
    if (!d) return "";
    return hashText(
      JSON.stringify([
        d.question,
        d.options.map((o) => [o.name, o.kind, o.description, o.benefits, o.costs, o.risks, o.reversibility]),
        d.criteria.map((c) => [c.name, c.weight]),
        d.ratings,
        d.constraints,
        d.assumptions,
      ]),
    );
  }
  const dec = state.decisions.find((x) => x.id === id);
  if (dec) return hashText(`${dec.updatedAt}|${dec.status}|${dec.finalChoice ?? ""}|${dec.outcomeReviews.length}`);
  return "";
}

/** Build a fingerprint over a set of dependency record ids. */
export function makeFingerprint(state: StoreState, ids: string[], embeddingModel?: string): SavedFingerprint {
  const deps: FingerprintDep[] = [...new Set(ids)]
    .filter(Boolean)
    .map((id) => ({ id, kind: kindOf(state, id), hash: hashOfRecordId(state, id) }));
  return { pipelineVersion: PIPELINE_VERSION, embeddingModel, deps, at: new Date().toISOString() };
}

// ---- dependency derivation per saved-record type ----

export function comparisonDeps(c: Comparison): string[] {
  return [...c.sourceIds, ...c.beliefIds];
}
export function inquiryDeps(i: Inquiry): string[] {
  return [...i.sourceIds, ...i.beliefIds, ...i.comparisonIds];
}
export function threadDeps(t: Megathread): string[] {
  return t.members.map((m) => m.id);
}
export function reasoningDeps(q: ReasoningQuery): string[] {
  return q.evidence.map((e) => e.id);
}
export function weeklyDeps(r: ReviewSession): string[] {
  return [...new Set((r.synthesis?.highlights ?? []).flatMap((h) => h.recordIds))];
}
/** Decision deps: its evidence records + its own configuration (options/criteria). */
export function decisionDeps(d: import("@/types/mvp").Decision): string[] {
  return [...d.evidence.map((e) => e.id), `decision-config:${d.id}`];
}

const KIND_NOUN: Record<string, [string, string]> = {
  belief: ["belief was revised", "beliefs were revised"],
  source: ["source changed", "sources changed"],
  comparison: ["comparison changed", "comparisons changed"],
  inquiry: ["inquiry changed", "inquiries changed"],
  megathread: ["thread changed", "threads changed"],
  capture: ["capture changed", "captures changed"],
  reflection: ["reflection changed", "reflections changed"],
  reasoning: ["reasoning result updated", "reasoning results updated"],
  practice: ["practice changed", "practices changed"],
  decision: ["earlier decision changed", "earlier decisions changed"],
  configuration: ["criterion or option changed", "criteria or options changed"],
  unknown: ["record changed", "records changed"],
};

export interface Freshness {
  status: FreshnessStatus;
  reasons: string[];
}

/**
 * Compare a saved fingerprint against current state. `currentIds` (the result's
 * present-day dependencies) enables "new evidence added" detection; when
 * omitted, only change-detection over the original deps runs.
 */
export function freshnessStatus(
  state: StoreState,
  fp: SavedFingerprint | undefined,
  currentIds?: string[],
): Freshness {
  if (!fp || fp.deps.length === 0) return { status: "unknown", reasons: ["No fingerprint was recorded."] };

  const reasons: string[] = [];
  let hardStale = false;

  if (fp.pipelineVersion !== PIPELINE_VERSION) {
    reasons.push("the processing pipeline changed");
    hardStale = true;
  }

  // Change detection over the original dependencies.
  const changedByKind = new Map<string, number>();
  let removed = 0;
  for (const dep of fp.deps) {
    const current = hashOfRecordId(state, dep.id);
    if (current === "") { removed++; continue; }
    if (current !== dep.hash) changedByKind.set(dep.kind, (changedByKind.get(dep.kind) ?? 0) + 1);
  }
  for (const [kind, n] of changedByKind) {
    const [one, many] = KIND_NOUN[kind] ?? KIND_NOUN.unknown;
    reasons.push(`${n} ${n === 1 ? one : many}`);
    hardStale = true;
  }
  if (removed > 0) { reasons.push(`${removed} referenced record${removed === 1 ? "" : "s"} removed`); hardStale = true; }

  // New-evidence detection (only when the caller supplies current deps).
  let added = 0;
  if (currentIds) {
    const known = new Set(fp.deps.map((d) => d.id));
    added = currentIds.filter((id) => !known.has(id) && hashOfRecordId(state, id) !== "").length;
    if (added > 0) reasons.push(`new evidence was added (${added})`);
  }

  const status: FreshnessStatus = hardStale ? "stale" : added > 0 ? "potentially_stale" : "current";
  if (status === "current") reasons.push("Up to date with your current evidence.");
  return { status, reasons };
}

export const FRESHNESS_LABEL: Record<FreshnessStatus, string> = {
  current: "Current",
  potentially_stale: "Possibly stale",
  stale: "Stale",
  unknown: "Unknown",
};
