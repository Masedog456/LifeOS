/**
 * Thread synthesis orchestrator (LIFEOS-012, Phase 6).
 *
 * Flow: deterministic membership → deterministic timeline → capped evidence
 * packet → ONE structured `thread_synthesis` AI call → deterministic
 * validation. Belief-evolution and recent-changes are computed deterministically
 * from the timeline and injected (always accurate). Mock fallback keeps it
 * functional offline. Regeneration is explicit; nothing runs in the background.
 */

import type { Megathread, StoreState, ThreadSynthesisData } from "@/types/mvp";
import { synthesizeThread } from "@/lib/aiClient";
import { buildThreadEvidence } from "@/lib/megathread/evidence";
import { validateThreadSynthesis } from "@/lib/megathread/synthesis";
import { buildTimeline } from "@/lib/megathread/timeline";

function beliefEvolution(state: StoreState, thread: Megathread): string[] {
  const excluded = new Set(thread.excluded);
  const out: string[] = [];
  for (const m of thread.members) {
    if (m.type !== "belief" || excluded.has(m.id)) continue;
    const b = state.beliefs.find((x) => x.id === m.id);
    if (!b) continue;
    const wordings = b.revisions.map((r) => r.text).filter((t, i, a) => t && a.indexOf(t) === i);
    if (wordings.length > 1) out.push(wordings.map((w) => `“${w}”`).join(" → "));
    else out.push(`“${b.text}” (${b.status})`);
  }
  return out.slice(0, 8);
}

function recentChanges(state: StoreState, thread: Megathread): string[] {
  return buildTimeline(state, thread)
    .slice(-4)
    .reverse()
    .map((t) => `${new Date(t.at).toLocaleDateString()} — ${t.title}`);
}

function unresolved(state: StoreState, thread: Megathread): string[] {
  const own = thread.unresolvedQuestions.filter((q) => !q.resolved).map((q) => q.text);
  const excluded = new Set(thread.excluded);
  const fromInquiries = thread.members
    .filter((m) => m.type === "inquiry" && !excluded.has(m.id))
    .map((m) => state.inquiries.find((i) => i.id === m.id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i) && i!.status === "unresolved")
    .map((i) => i.question);
  return [...new Set([...own, ...fromInquiries])].slice(0, 10);
}

/** Pre-flight estimate for the thread page (Phase 6). */
export function estimateThreadSynthesis(state: StoreState, thread: Megathread): {
  calls: number;
  evidenceCount: number;
  partial: boolean;
  coverageNote: string;
} {
  const { flat, partial, coverageNote } = buildThreadEvidence(state, thread);
  return { calls: 1, evidenceCount: flat.length, partial, coverageNote };
}

/** Run one synthesis. Returns synthesis + the evidence packet it cites. */
export async function runThreadSynthesis(
  state: StoreState,
  thread: Megathread,
): Promise<{ synthesis: ThreadSynthesisData; evidence: ReturnType<typeof buildThreadEvidence>["flat"]; source: "ai" | "mock" }> {
  const { flat, coverageNote } = buildThreadEvidence(state, thread);
  const validIds = new Set(flat.map((e) => e.id));

  const { result: raw, source } = await synthesizeThread({ evidence: flat, title: thread.title, coverageNote });
  const synthesis = validateThreadSynthesis(raw, validIds, { coverageNote });

  // Deterministic, always-accurate narrative fields.
  synthesis.beliefEvolution = beliefEvolution(state, thread);
  synthesis.recentChanges = recentChanges(state, thread);
  synthesis.unresolvedQuestions = [...new Set([...unresolved(state, thread), ...synthesis.unresolvedQuestions])].slice(0, 10);

  return { synthesis, evidence: flat, source };
}
