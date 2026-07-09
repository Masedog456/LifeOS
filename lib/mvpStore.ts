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
  JudgmentEntry,
  Proposal,
  RevisionEntry,
  StoreState,
} from "@/types/mvp";
import type { ProposalDraft } from "@/lib/proposals";

const STORAGE_KEY = "lifeos.mvp.v1";

/** Stable empty state — used for the server snapshot and pre-hydration client render. */
const EMPTY_STATE: StoreState = { captures: [], proposals: [], beliefs: [] };

let state: StoreState = EMPTY_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota/serialization errors in the prototype.
  }
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

/** Hydrate once from localStorage (called from a client effect). */
export function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoreState>;
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
      };
      emit();
    }
  } catch {
    // Corrupt storage → start clean rather than crash.
  }
}

/** Wipe all local prototype data. For the local trial only. */
export function resetStore() {
  setState({ captures: [], proposals: [], beliefs: [] });
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
export function addCapture(text: string): string {
  const capture: Capture = { id: id(), text: text.trim(), createdAt: now() };
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
