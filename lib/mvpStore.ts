/**
 * LIFEOS-002 MVP store.
 *
 * A tiny module-level reactive store persisted to localStorage, shared
 * across all screens via `useSyncExternalStore`. No database, no external
 * state library. Everything here is client-side and survives reloads on
 * the same browser only — this is a prototype data layer, deliberately.
 */

import { useSyncExternalStore } from "react";
import type {
  Belief,
  Capture,
  Comparison,
  ComparisonDecision,
  FeedbackEntry,
  FeedbackVerdict,
  JudgmentEntry,
  KnowledgeChunk,
  KnowledgeSource,
  ProcessingState,
  Proposal,
  RevisionEntry,
  StoreState,
} from "@/types/mvp";
import { emptyAnalysis, emptyStages } from "@/types/mvp";
import type { ProposalDraft } from "@/lib/proposals";
import { clearState, loadState, saveLocalOnly, saveState } from "@/lib/persistence";

/** Stable empty state — used for the server snapshot and pre-hydration client render. */
const EMPTY_STATE: StoreState = {
  captures: [],
  proposals: [],
  beliefs: [],
  sources: [],
  feedback: [],
  comparisons: [],
};

let state: StoreState = EMPTY_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  saveState(state);
}

function setState(next: StoreState) {
  state = next;
  persist();
  emit();
}

function now(): string {
  return new Date().toISOString();
}

function id(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function asArray<T>(value: unknown): T[] {
  // Guard against malformed localStorage where a field isn't an array
  // (e.g. hand-edited data) — a non-array would crash later map/filter.
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Hydrate once from the persistence layer (called from a client effect). */
export function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const parsed = loadState();
    if (parsed) {
      state = {
        captures: asArray<Capture>(parsed.captures),
        proposals: asArray<Proposal>(parsed.proposals),
        beliefs: asArray<Belief>(parsed.beliefs).map((b) => ({
          // Defensively ensure the append-only arrays exist, so the
          // Constitution/ThreadLine never read undefined.
          ...b,
          revisions: asArray<RevisionEntry>(b?.revisions),
          judgments: asArray<JudgmentEntry>(b?.judgments),
        })),
        sources: asArray<KnowledgeSource>(parsed.sources).map((s) => ({
          ...s,
          chunks: asArray<KnowledgeChunk>(s?.chunks),
          keyQuotes: asArray<string>(s?.keyQuotes),
          keyConcepts: asArray<string>(s?.keyConcepts),
          candidateBeliefs: asArray<string>(s?.candidateBeliefs),
        })),
        feedback: asArray<FeedbackEntry>(parsed.feedback),
        comparisons: asArray<Comparison>(parsed.comparisons).map((c) => ({
          ...c,
          judgments: asArray<Comparison["judgments"][number]>(c?.judgments),
        })),
      };
      emit();
    }
  } catch {
    // Corrupt storage → start clean rather than crash.
  }
}

/** Wipe all data (local + remote, if configured). */
export function resetStore() {
  clearState();
  setState({ captures: [], proposals: [], beliefs: [], sources: [], feedback: [], comparisons: [] });
}

/** Record user feedback on a surfaced retrieval record (append-only). */
export function recordFeedback(
  recordId: string,
  verdict: FeedbackVerdict,
  snoozeMinutes?: number,
): void {
  const entry: FeedbackEntry = {
    recordId,
    verdict,
    at: now(),
    ...(verdict === "snoozed" && snoozeMinutes
      ? { snoozeUntil: new Date(Date.now() + snoozeMinutes * 60_000).toISOString() }
      : {}),
  };
  setState({ ...state, feedback: [entry, ...state.feedback] });
}

/**
 * Replace the in-memory store with adopted remote data. Persists locally
 * only (no remote re-push) and notifies subscribers. Used by the
 * persistence bootstrap after loading from Supabase.
 */
export function replaceState(next: StoreState) {
  state = next;
  saveLocalOnly(next);
  emit();
}

// ---------- Subscription plumbing ----------

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): StoreState {
  return state;
}

function getServerSnapshot(): StoreState {
  return EMPTY_STATE;
}

export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ---------- Actions ----------

/** Save a capture locally. Always call this before any AI work. Returns the new id. */
export function addCapture(text: string, sourceId?: string): string {
  const capture: Capture = {
    id: id(),
    text: text.trim(),
    createdAt: now(),
    ...(sourceId ? { sourceId } : {}),
  };
  setState({ ...state, captures: [capture, ...state.captures] });
  return capture.id;
}

/** Attach proposals (from AI or mock) to an existing capture. */
export function attachProposals(
  captureId: string,
  drafts: ProposalDraft[],
  source: "ai" | "mock",
): void {
  const proposals: Proposal[] = drafts.map((d) => ({
    id: id(),
    captureId,
    claim: d.claim,
    theme: d.theme,
    spanStart: d.spanStart,
    spanEnd: d.spanEnd,
    source,
    createdAt: now(),
    resolved: false,
  }));
  setState({ ...state, proposals: [...proposals, ...state.proposals] });
}

function resolveProposal(proposalId: string): Proposal | undefined {
  const proposal = state.proposals.find((p) => p.id === proposalId);
  if (!proposal) return undefined;
  setState({
    ...state,
    proposals: state.proposals.map((p) =>
      p.id === proposalId ? { ...p, resolved: true } : p,
    ),
  });
  return proposal;
}

function addBelief(belief: Belief) {
  setState({ ...state, beliefs: [belief, ...state.beliefs] });
}

/**
 * Judge a proposal. `rewrite` supplies the user's own wording (the
 * primary action); the others use the proposed claim as-is.
 */
export function judgeProposal(
  proposalId: string,
  decision: "accepted" | "rewritten" | "rejected" | "questioned",
  rewriteText?: string,
): void {
  const proposal = resolveProposal(proposalId);
  if (!proposal) return;

  const at = now();
  const status: Belief["status"] =
    decision === "accepted"
      ? "accepted"
      : decision === "rewritten"
        ? "revised"
        : decision === "questioned"
          ? "questioned"
          : "rejected";

  const finalText =
    decision === "rewritten" && rewriteText?.trim()
      ? rewriteText.trim()
      : proposal.claim;

  const revisions: RevisionEntry[] = [
    { text: proposal.claim, at, reason: "proposed" },
  ];
  if (decision === "rewritten" && finalText !== proposal.claim) {
    revisions.push({ text: finalText, at, reason: "rewritten" });
  } else if (decision === "accepted") {
    revisions[0] = { text: proposal.claim, at, reason: "accepted" };
  }

  const belief: Belief = {
    id: id(),
    captureId: proposal.captureId,
    proposalId: proposal.id,
    text: finalText,
    theme: proposal.theme,
    status,
    createdAt: at,
    updatedAt: at,
    revisions,
    judgments: [{ decision, at }],
  };
  addBelief(belief);
}

function updateBelief(beliefId: string, update: (b: Belief) => Belief) {
  setState({
    ...state,
    beliefs: state.beliefs.map((b) => (b.id === beliefId ? update(b) : b)),
  });
}

/** Re-judge an existing belief over time (this is how a thread visibly bends). */
export function reviseBelief(beliefId: string, newText: string): void {
  const text = newText.trim();
  if (!text) return;
  const at = now();
  updateBelief(beliefId, (b) => ({
    ...b,
    text,
    status: "revised",
    updatedAt: at,
    revisions: [...b.revisions, { text, at, reason: "rewritten" }],
    judgments: [...b.judgments, { decision: "rewritten", at }],
  }));
}

export function affirmBelief(beliefId: string): void {
  const at = now();
  updateBelief(beliefId, (b) => ({
    ...b,
    status: "accepted",
    updatedAt: at,
    revisions: [...b.revisions, { text: b.text, at, reason: "reaffirmed" }],
    judgments: [...b.judgments, { decision: "reaffirmed", at }],
  }));
}

export function questionBelief(beliefId: string): void {
  const at = now();
  updateBelief(beliefId, (b) => ({
    ...b,
    status: "questioned",
    updatedAt: at,
    revisions: [...b.revisions, { text: b.text, at, reason: "questioned" }],
    judgments: [...b.judgments, { decision: "questioned", at }],
  }));
}

// ---------- Selectors ----------

export function captureById(s: StoreState, captureId: string): Capture | undefined {
  return s.captures.find((c) => c.id === captureId);
}

export function pendingProposals(s: StoreState): Proposal[] {
  // Oldest first, so the user reviews in the order thoughts arrived.
  return s.proposals
    .filter((p) => !p.resolved)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Pick one belief to resurface on Home: the least-recently-touched
 * non-rejected belief. Deterministic given the state.
 */
export function resurfacedBelief(s: StoreState): Belief | undefined {
  const active = s.beliefs.filter((b) => b.status !== "rejected");
  if (active.length === 0) return undefined;
  return [...active].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[0];
}

// ---------- Knowledge Library actions (LIFEOS-003) ----------

/** Add a source to the library. Returns its id. Original text is immutable hereafter. */
export function addSource(
  fields: Pick<KnowledgeSource, "type" | "input" | "title" | "originalText"> &
    Partial<
      Pick<
        KnowledgeSource,
        | "author"
        | "origin"
        | "processingState"
        | "pdfMeta"
        | "pageMap"
        | "extractionStatus"
      >
    >,
): string {
  const source: KnowledgeSource = {
    id: id(),
    type: fields.type,
    input: fields.input,
    title: fields.title.trim() || "Untitled",
    author: fields.author?.trim() || undefined,
    origin: fields.origin?.trim() || undefined,
    addedAt: now(),
    status: "unread",
    processingState: fields.processingState ?? "captured",
    originalText: fields.originalText,
    chunks: [],
    keyQuotes: [],
    keyConcepts: [],
    candidateBeliefs: [],
    chunkResults: [],
    stages: emptyStages(),
    analysis: emptyAnalysis(),
    pdfMeta: fields.pdfMeta,
    pageMap: fields.pageMap,
    extractionStatus: fields.extractionStatus,
  };
  setState({ ...state, sources: [source, ...state.sources] });
  return source.id;
}

/** Non-hook read of the current source (for the pipeline, which isn't a component). */
export function getSource(sourceId: string): KnowledgeSource | undefined {
  return state.sources.find((s) => s.id === sourceId);
}

function updateSource(sourceId: string, update: (s: KnowledgeSource) => KnowledgeSource) {
  setState({
    ...state,
    sources: state.sources.map((s) => (s.id === sourceId ? update(s) : s)),
  });
}

/** Patch derived/metadata fields on a source. Never touches originalText. */
export function patchSource(
  sourceId: string,
  patch: Partial<
    Omit<KnowledgeSource, "id" | "originalText" | "input" | "addedAt">
  >,
): void {
  updateSource(sourceId, (s) => ({ ...s, ...patch }));
}

export function setProcessingState(
  sourceId: string,
  processingState: ProcessingState,
  processingError?: string,
): void {
  updateSource(sourceId, (s) => ({ ...s, processingState, processingError }));
}

export function setSourceStatus(sourceId: string, status: KnowledgeSource["status"]): void {
  updateSource(sourceId, (s) => ({ ...s, status }));
}

/**
 * Set the original text for a source that was created without it (a PDF or
 * URL awaiting its extracted/pasted body). Allowed only while originalText
 * is still empty — this is a one-time set, never an edit of existing
 * immutable text.
 */
export function setOriginalText(sourceId: string, text: string): boolean {
  const src = state.sources.find((s) => s.id === sourceId);
  if (!src || src.originalText.trim().length > 0) return false;
  updateSource(sourceId, (s) => ({ ...s, originalText: text, processingState: "captured" }));
  return true;
}

/** Save a highlighted quote from the reader into the source's key quotes (deduped). */
export function saveQuote(sourceId: string, quote: string): void {
  const q = quote.trim();
  if (!q) return;
  updateSource(sourceId, (s) =>
    s.keyQuotes.includes(q) ? s : { ...s, keyQuotes: [q, ...s.keyQuotes] },
  );
}

/**
 * Send text to the Belief Inbox: create a Capture (linked to the source)
 * and attach the given belief proposals. Reuses the exact same inbox
 * pipeline as Home — candidates never bypass the inbox into the
 * Constitution. Returns the capture id.
 */
export function sendToInbox(
  text: string,
  drafts: ProposalDraft[],
  aiSource: "ai" | "mock",
  sourceId?: string,
): string {
  const captureId = addCapture(text, sourceId);
  attachProposals(captureId, drafts, aiSource);
  return captureId;
}

// ---------- Knowledge Library selectors ----------

export function sourceById(s: StoreState, sourceId: string): KnowledgeSource | undefined {
  return s.sources.find((x) => x.id === sourceId);
}

export function searchSources(
  s: StoreState,
  query: string,
  type: string | "all",
): KnowledgeSource[] {
  const q = query.trim().toLowerCase();
  return s.sources
    .filter((src) => (type === "all" ? true : src.type === type))
    .filter(
      (src) =>
        !q ||
        src.title.toLowerCase().includes(q) ||
        (src.author?.toLowerCase().includes(q) ?? false),
    );
}

/** Beliefs formed from captures that trace back to a given source. */
export function beliefsFromSource(s: StoreState, sourceId: string): Belief[] {
  const captureIds = new Set(
    s.captures.filter((c) => c.sourceId === sourceId).map((c) => c.id),
  );
  return s.beliefs.filter((b) => captureIds.has(b.captureId));
}

// ---------- Comparative intelligence actions (LIFEOS-010) ----------

/** Persist a completed comparison (a proposal, never a Constitution change). */
export function saveComparison(comparison: Comparison): void {
  setState({ ...state, comparisons: [comparison, ...state.comparisons] });
}

/** Append a human judgment on one comparison insight (append-only). */
export function judgeComparisonInsight(
  comparisonId: string,
  insightRef: string,
  decision: ComparisonDecision,
  note?: string,
): void {
  const at = now();
  setState({
    ...state,
    comparisons: state.comparisons.map((c) =>
      c.id === comparisonId
        ? { ...c, judgments: [...c.judgments, { insightRef, decision, at, ...(note ? { note } : {}) }] }
        : c,
    ),
  });
}

export function comparisonById(s: StoreState, comparisonId: string): Comparison | undefined {
  return s.comparisons.find((c) => c.id === comparisonId);
}
