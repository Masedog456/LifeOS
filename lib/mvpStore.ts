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
  Inquiry,
  InquiryStatus,
  JudgmentEntry,
  KnowledgeChunk,
  KnowledgeSource,
  Megathread,
  MegathreadStatus,
  ProcessingState,
  Proposal,
  RevisionEntry,
  StoreState,
  ThreadMemberRef,
  ThreadSynthesisData,
  AlignmentData,
  PracticeCadence,
  PracticeCandidate,
  PracticeDerivation,
  PracticeStatus,
  Reflection,
  ReviewDecision,
  ReviewSession,
  ReviewSurfacedItem,
  ReviewType,
  WeeklySynthesisData,
  ReasoningQuery,
  ReasoningStatus,
  EmbeddingRecord,
} from "@/types/mvp";
import { emptyAnalysis, emptyStages } from "@/types/mvp";
import type { ProposalDraft } from "@/lib/proposals";
import { clearState, loadState, saveLocalOnly, saveState } from "@/lib/persistence";
import { makeFingerprint, threadDeps, weeklyDeps } from "@/lib/freshness/fingerprint";

/** Stable empty state — used for the server snapshot and pre-hydration client render. */
const EMPTY_STATE: StoreState = {
  captures: [],
  proposals: [],
  beliefs: [],
  sources: [],
  feedback: [],
  comparisons: [],
  inquiries: [],
  megathreads: [],
  reflections: [],
  practices: [],
  reviews: [],
  reasonings: [],
  embeddings: [],
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
        inquiries: asArray<Inquiry>(parsed.inquiries).map((i) => ({
          ...i,
          judgments: asArray<Inquiry["judgments"][number]>(i?.judgments),
          history: asArray<Inquiry["history"][number]>(i?.history),
        })),
        megathreads: asArray<Megathread>(parsed.megathreads).map((t) => ({
          ...t,
          members: asArray<ThreadMemberRef>(t?.members),
          pinned: asArray<string>(t?.pinned),
          excluded: asArray<string>(t?.excluded),
          unresolvedQuestions: asArray<Megathread["unresolvedQuestions"][number]>(t?.unresolvedQuestions),
          judgments: asArray<Megathread["judgments"][number]>(t?.judgments),
          revisions: asArray<Megathread["revisions"][number]>(t?.revisions),
        })),
        reflections: asArray<Reflection>(parsed.reflections).map((r) => ({
          ...r,
          annotations: asArray<Reflection["annotations"][number]>(r?.annotations),
        })),
        practices: asArray<PracticeCandidate>(parsed.practices).map((p) => ({
          ...p,
          history: asArray<PracticeCandidate["history"][number]>(p?.history),
        })),
        reviews: asArray<ReviewSession>(parsed.reviews).map((r) => ({
          ...r,
          surfaced: asArray<ReviewSurfacedItem>(r?.surfaced),
          reflectionIds: asArray<string>(r?.reflectionIds),
          judgments: asArray<ReviewSession["judgments"][number]>(r?.judgments),
          acceptedPracticeIds: asArray<string>(r?.acceptedPracticeIds),
          unresolvedQuestions: asArray<string>(r?.unresolvedQuestions),
        })),
        reasonings: asArray<ReasoningQuery>(parsed.reasonings).map((q) => ({
          ...q,
          evidence: asArray<ReasoningQuery["evidence"][number]>(q?.evidence),
          history: asArray<ReasoningQuery["history"][number]>(q?.history),
          judgments: asArray<ReasoningQuery["judgments"][number]>(q?.judgments),
        })),
        embeddings: asArray<EmbeddingRecord>(parsed.embeddings),
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
  setState({
    captures: [], proposals: [], beliefs: [], sources: [], feedback: [],
    comparisons: [], inquiries: [], megathreads: [], reflections: [], practices: [], reviews: [], reasonings: [], embeddings: [],
  });
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

/** Non-hook read of the whole store (for orchestrators triggered from events). */
export function getStoreSnapshot(): StoreState {
  return state;
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

/** Replace a comparison in place (used by rerun; history already appended). */
export function updateComparison(comparison: Comparison): void {
  setState({ ...state, comparisons: state.comparisons.map((c) => (c.id === comparison.id ? comparison : c)) });
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

// ---------- Dialectical intelligence actions (LIFEOS-011) ----------

/** Persist a completed inquiry (a reasoning aid, never a Constitution change). */
export function saveInquiry(inquiry: Inquiry): void {
  setState({ ...state, inquiries: [inquiry, ...state.inquiries] });
}

/**
 * Replace an inquiry with an evolved version (the evolver has already pushed
 * the prior result into append-only `history`). Preserves list position.
 */
export function updateInquiry(inquiry: Inquiry): void {
  setState({
    ...state,
    inquiries: state.inquiries.map((i) => (i.id === inquiry.id ? inquiry : i)),
  });
}

function patchInquiry(inquiryId: string, patch: (i: Inquiry) => Inquiry): void {
  setState({
    ...state,
    inquiries: state.inquiries.map((i) => (i.id === inquiryId ? patch(i) : i)),
  });
}

/** Append a human judgment on one inquiry insight (append-only). */
export function judgeInquiryInsight(
  inquiryId: string,
  insightRef: string,
  decision: ComparisonDecision,
  note?: string,
): void {
  const at = now();
  patchInquiry(inquiryId, (i) => ({
    ...i,
    judgments: [...i.judgments, { insightRef, decision, at, ...(note ? { note } : {}) }],
    updatedAt: at,
  }));
}

/** Write/replace the user's own provisional conclusion (also sets status). */
export function setInquiryConclusion(inquiryId: string, text: string, status: InquiryStatus = "provisional"): void {
  patchInquiry(inquiryId, (i) => ({ ...i, provisionalConclusion: text.trim() || undefined, status, updatedAt: now() }));
}

export function setInquiryStatus(inquiryId: string, status: InquiryStatus): void {
  patchInquiry(inquiryId, (i) => ({ ...i, status, updatedAt: now() }));
}

export function inquiryById(s: StoreState, inquiryId: string): Inquiry | undefined {
  return s.inquiries.find((i) => i.id === inquiryId);
}

// ---------- Megathread actions (LIFEOS-012) ----------

export function createMegathread(fields: {
  title: string;
  description?: string;
  seedType: Megathread["seedType"];
  seedId?: string;
  seedLabel?: string;
  members?: ThreadMemberRef[];
}): string {
  const at = now();
  const thread: Megathread = {
    id: id(),
    title: fields.title.trim() || "Untitled thread",
    description: fields.description?.trim() || undefined,
    status: "active",
    seedType: fields.seedType,
    seedId: fields.seedId,
    seedLabel: fields.seedLabel,
    members: fields.members ?? [],
    pinned: [],
    excluded: [],
    unresolvedQuestions: [],
    judgments: [],
    revisions: [{ at, note: "Thread created" }],
    createdAt: at,
    updatedAt: at,
  };
  setState({ ...state, megathreads: [thread, ...state.megathreads] });
  return thread.id;
}

function patchThread(threadId: string, patch: (t: Megathread) => Megathread, logNote?: string): void {
  const at = now();
  setState({
    ...state,
    megathreads: state.megathreads.map((t) => {
      if (t.id !== threadId) return t;
      const next = patch(t);
      return {
        ...next,
        updatedAt: at,
        revisions: logNote ? [...t.revisions, { at, note: logNote }] : next.revisions,
      };
    }),
  });
}

export function updateMegathread(thread: Megathread): void {
  patchThread(thread.id, () => thread);
}

export function setThreadFields(
  threadId: string,
  fields: Partial<Pick<Megathread, "title" | "description" | "notes">>,
): void {
  patchThread(threadId, (t) => ({ ...t, ...fields }));
}

export function setThreadStatus(threadId: string, status: MegathreadStatus): void {
  patchThread(threadId, (t) => ({ ...t, status }), `Marked ${status}`);
}

export function addThreadMember(threadId: string, ref: ThreadMemberRef): void {
  patchThread(
    threadId,
    (t) =>
      t.members.some((m) => m.type === ref.type && m.id === ref.id)
        ? t
        : { ...t, members: [...t.members, { ...ref, at: now() }], excluded: t.excluded.filter((x) => x !== ref.id) },
    `Added ${ref.type}`,
  );
}

export function removeThreadMember(threadId: string, type: ThreadMemberRef["type"], memberId: string): void {
  patchThread(threadId, (t) => ({
    ...t,
    members: t.members.filter((m) => !(m.type === type && m.id === memberId)),
    pinned: t.pinned.filter((x) => x !== memberId),
  }));
}

/** Exclude a record: remove it as a member and never auto-suggest it again. */
export function excludeThreadItem(threadId: string, recordId: string): void {
  patchThread(threadId, (t) => ({
    ...t,
    members: t.members.filter((m) => m.id !== recordId),
    pinned: t.pinned.filter((x) => x !== recordId),
    excluded: t.excluded.includes(recordId) ? t.excluded : [...t.excluded, recordId],
  }));
}

export function toggleThreadPin(threadId: string, memberId: string): void {
  patchThread(threadId, (t) => ({
    ...t,
    pinned: t.pinned.includes(memberId) ? t.pinned.filter((x) => x !== memberId) : [...t.pinned, memberId],
  }));
}

export function setThreadSynthesis(
  threadId: string,
  synthesis: ThreadSynthesisData,
  source: "ai" | "mock" | "user",
  evidence?: Megathread["synthesisEvidence"],
): void {
  patchThread(
    threadId,
    (t) => ({
      ...t,
      synthesis,
      synthesisSource: source,
      synthesisEvidence: evidence ?? t.synthesisEvidence,
      fingerprint: makeFingerprint(state, threadDeps(t)),
    }),
    source === "user" ? "Synthesis rewritten by you" : "Synthesis regenerated",
  );
}

export function addThreadQuestion(threadId: string, text: string): void {
  const q = text.trim();
  if (!q) return;
  patchThread(threadId, (t) =>
    t.unresolvedQuestions.some((x) => x.text === q)
      ? t
      : { ...t, unresolvedQuestions: [...t.unresolvedQuestions, { text: q, resolved: false }] },
  );
}

export function toggleThreadQuestion(threadId: string, index: number): void {
  patchThread(threadId, (t) => ({
    ...t,
    unresolvedQuestions: t.unresolvedQuestions.map((q, i) => (i === index ? { ...q, resolved: !q.resolved } : q)),
  }));
}

export function judgeThreadInsight(
  threadId: string,
  insightRef: string,
  decision: ComparisonDecision,
  note?: string,
): void {
  const at = now();
  patchThread(threadId, (t) => ({
    ...t,
    judgments: [...t.judgments, { insightRef, decision, at, ...(note ? { note } : {}) }],
  }));
}

export function megathreadById(s: StoreState, threadId: string): Megathread | undefined {
  return s.megathreads.find((t) => t.id === threadId);
}

/** Existing threads seeded by the same record — used to warn about duplicates. */
export function threadsForSeed(s: StoreState, seedType: Megathread["seedType"], seedId?: string): Megathread[] {
  if (!seedId) return [];
  return s.megathreads.filter((t) => t.seedType === seedType && t.seedId === seedId);
}

// ---------- Formation actions (LIFEOS-013) ----------

/** Save a reflection. `response` is immutable; annotations are added separately. */
export function addReflection(fields: {
  prompt: string;
  response: string;
  beliefIds?: string[];
  threadIds?: string[];
  sourceIds?: string[];
  context?: string;
}): string {
  const reflection: Reflection = {
    id: id(),
    prompt: fields.prompt,
    response: fields.response.trim(),
    createdAt: now(),
    beliefIds: fields.beliefIds,
    threadIds: fields.threadIds,
    sourceIds: fields.sourceIds,
    context: fields.context?.trim() || undefined,
    annotations: [],
  };
  setState({ ...state, reflections: [reflection, ...state.reflections] });
  return reflection.id;
}

/** Append a later note to a reflection (kept separate from the immutable original). */
export function annotateReflection(reflectionId: string, text: string): void {
  const t = text.trim();
  if (!t) return;
  setState({
    ...state,
    reflections: state.reflections.map((r) =>
      r.id === reflectionId ? { ...r, annotations: [...r.annotations, { text: t, at: now() }] } : r,
    ),
  });
}

export interface PracticeDraftInput {
  title: string;
  description: string;
  rationale: string;
  cadence?: PracticeCadence;
  derivedFrom: PracticeDerivation;
}

/** Create proposed practice candidates from validated drafts. Returns their ids. */
export function addPractices(drafts: PracticeDraftInput[], source: "ai" | "mock"): string[] {
  const at = now();
  const created: PracticeCandidate[] = drafts.map((d) => ({
    id: id(),
    title: d.title,
    description: d.description,
    rationale: d.rationale,
    derivedFrom: d.derivedFrom,
    cadence: d.cadence,
    status: "proposed",
    source,
    createdAt: at,
    updatedAt: at,
    history: [{ at, status: "proposed" }],
  }));
  setState({ ...state, practices: [...created, ...state.practices] });
  return created.map((p) => p.id);
}

function patchPractice(practiceId: string, patch: (p: PracticeCandidate) => PracticeCandidate): void {
  setState({
    ...state,
    practices: state.practices.map((p) => (p.id === practiceId ? patch(p) : p)),
  });
}

/** Change a practice's status (append-only history). Never scheduled or tracked. */
export function setPracticeStatus(practiceId: string, status: PracticeStatus, note?: string): void {
  const at = now();
  patchPractice(practiceId, (p) => ({
    ...p,
    status,
    updatedAt: at,
    history: [...p.history, { at, status, ...(note ? { note } : {}) }],
  }));
}

export function editPracticeWording(practiceId: string, wording: string): void {
  patchPractice(practiceId, (p) => ({ ...p, userWording: wording.trim() || undefined, source: "user", updatedAt: now() }));
}

/** Start a review session with the deterministically-surfaced items. Returns its id. */
export function startReview(type: ReviewType, surfaced: ReviewSurfacedItem[]): string {
  const session: ReviewSession = {
    id: id(),
    type,
    surfaced,
    reflectionIds: [],
    judgments: [],
    acceptedPracticeIds: [],
    unresolvedQuestions: [],
    startedAt: now(),
  };
  setState({ ...state, reviews: [session, ...state.reviews] });
  return session.id;
}

function patchReview(reviewId: string, patch: (r: ReviewSession) => ReviewSession): void {
  setState({
    ...state,
    reviews: state.reviews.map((r) => (r.id === reviewId ? patch(r) : r)),
  });
}

export function recordReviewJudgment(reviewId: string, itemId: string, decision: ReviewDecision, note?: string): void {
  patchReview(reviewId, (r) => ({
    ...r,
    judgments: [...r.judgments, { itemId, decision, at: now(), ...(note ? { note } : {}) }],
  }));
}

export function attachReflectionToReview(reviewId: string, reflectionId: string): void {
  patchReview(reviewId, (r) =>
    r.reflectionIds.includes(reflectionId) ? r : { ...r, reflectionIds: [...r.reflectionIds, reflectionId] },
  );
}

export function markPracticeAcceptedInReview(reviewId: string, practiceId: string): void {
  patchReview(reviewId, (r) =>
    r.acceptedPracticeIds.includes(practiceId) ? r : { ...r, acceptedPracticeIds: [...r.acceptedPracticeIds, practiceId] },
  );
}

export function setReviewSynthesis(reviewId: string, synthesis: WeeklySynthesisData, source: "ai" | "mock"): void {
  patchReview(reviewId, (r) => {
    const next = { ...r, synthesis, synthesisSource: source };
    return { ...next, fingerprint: makeFingerprint(state, weeklyDeps(next)) };
  });
}

// ---------- Semantic index actions (LIFEOS-015) ----------

/** Merge new embeddings, replacing any prior embedding for the same record. */
export function addEmbeddings(records: EmbeddingRecord[]): void {
  if (records.length === 0) return;
  const byId = new Map(state.embeddings.map((e) => [e.recordId, e]));
  for (const r of records) byId.set(r.recordId, r);
  setState({ ...state, embeddings: [...byId.values()] });
}

export function setReviewAlignment(reviewId: string, alignment: AlignmentData, source: "ai" | "mock"): void {
  patchReview(reviewId, (r) => ({ ...r, alignment, alignmentSource: source }));
}

export function completeReview(reviewId: string): void {
  patchReview(reviewId, (r) => (r.completedAt ? r : { ...r, completedAt: now() }));
}

export function reviewById(s: StoreState, reviewId: string): ReviewSession | undefined {
  return s.reviews.find((r) => r.id === reviewId);
}

// ---------- Reasoning engine actions (LIFEOS-014) ----------

/** Persist a completed reasoning query (a reasoning aid, never a Constitution change). */
export function saveReasoning(query: ReasoningQuery): void {
  setState({ ...state, reasonings: [query, ...state.reasonings] });
}

/** Replace a reasoning query with a re-run version (history already appended). */
export function updateReasoning(query: ReasoningQuery): void {
  setState({ ...state, reasonings: state.reasonings.map((q) => (q.id === query.id ? query : q)) });
}

function patchReasoning(reasoningId: string, patch: (q: ReasoningQuery) => ReasoningQuery): void {
  setState({ ...state, reasonings: state.reasonings.map((q) => (q.id === reasoningId ? patch(q) : q)) });
}

/** Append a human judgment on one reasoning finding (append-only). */
export function judgeReasoningInsight(
  reasoningId: string,
  insightRef: string,
  decision: ComparisonDecision,
  note?: string,
): void {
  const at = now();
  patchReasoning(reasoningId, (q) => ({
    ...q,
    judgments: [...q.judgments, { insightRef, decision, at, ...(note ? { note } : {}) }],
    updatedAt: at,
  }));
}

export function setReasoningConclusion(reasoningId: string, text: string, status: ReasoningStatus = "provisional"): void {
  patchReasoning(reasoningId, (q) => ({ ...q, provisionalConclusion: text.trim() || undefined, status, updatedAt: now() }));
}

export function setReasoningStatus(reasoningId: string, status: ReasoningStatus): void {
  patchReasoning(reasoningId, (q) => ({ ...q, status, updatedAt: now() }));
}

/** Attach a reasoning result to a Megathread (adds a note + logs a revision). */
export function attachReasoningToThread(reasoningId: string, threadId: string): void {
  const q = state.reasonings.find((x) => x.id === reasoningId);
  if (!q) return;
  const at = now();
  const note = `Reasoning attached: ${q.question || q.mode}`;
  setState({
    ...state,
    megathreads: state.megathreads.map((t) =>
      t.id === threadId
        ? {
            ...t,
            notes: [t.notes, note].filter(Boolean).join("\n"),
            revisions: [...t.revisions, { at, note }],
            updatedAt: at,
          }
        : t,
    ),
  });
}

export function reasoningById(s: StoreState, reasoningId: string): ReasoningQuery | undefined {
  return s.reasonings.find((q) => q.id === reasoningId);
}
