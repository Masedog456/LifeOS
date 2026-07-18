/**
 * Dialectical conversation memory (LIFEOS-023).
 *
 * A derived, read-only view over the tensions and syntheses of a dialogue: what
 * has been integrated, what was abandoned, what remains open, and which
 * conflicts keep recurring (tensions that share member records). Built fresh
 * each render from the store — never persisted, never mutated here.
 */

import type { Synthesis, StoreState, Tension } from "@/types/mvp";

export interface RecurringConflict {
  /** A record id that participates in more than one tension. */
  refId: string;
  label: string;
  tensionIds: string[];
}

export interface DialecticMemory {
  /** Accepted syntheses, newest first — the refinements that survived. */
  previousSyntheses: Synthesis[];
  /** Rejected or superseded syntheses — the paths tried and set aside. */
  abandonedSyntheses: Synthesis[];
  /** Tensions still open or under synthesis. */
  unresolvedTensions: Tension[];
  /** Records that recur across multiple tensions in this dialogue. */
  recurringConflicts: RecurringConflict[];
}

export function buildDialecticMemory(state: StoreState, dialogueId: string): DialecticMemory {
  const tensions = state.tensions.filter((t) => t.dialogueId === dialogueId);
  const syntheses = state.syntheses.filter((s) => s.dialogueId === dialogueId);

  const byNewest = <T extends { updatedAt: string }>(a: T, b: T) => (a.updatedAt < b.updatedAt ? 1 : -1);

  const previousSyntheses = syntheses.filter((s) => s.status === "accepted").sort(byNewest);
  const abandonedSyntheses = syntheses.filter((s) => s.status === "rejected" || s.status === "superseded").sort(byNewest);
  const unresolvedTensions = tensions
    .filter((t) => t.status === "open" || t.status === "under_synthesis")
    .sort(byNewest);

  // Recurring conflicts: a member record that appears in ≥2 tensions.
  const byRef = new Map<string, { label: string; tensionIds: Set<string> }>();
  for (const t of tensions) {
    for (const link of t.evidence) {
      const entry = byRef.get(link.refId) ?? { label: link.label, tensionIds: new Set<string>() };
      entry.tensionIds.add(t.id);
      byRef.set(link.refId, entry);
    }
  }
  const recurringConflicts: RecurringConflict[] = [...byRef.entries()]
    .filter(([, v]) => v.tensionIds.size >= 2)
    .map(([refId, v]) => ({ refId, label: v.label, tensionIds: [...v.tensionIds] }));

  return { previousSyntheses, abandonedSyntheses, unresolvedTensions, recurringConflicts };
}
