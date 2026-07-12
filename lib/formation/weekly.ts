/**
 * Weekly review — deterministic counts first, one optional AI narrative
 * (LIFEOS-013, Phase 6). Every synthesis highlight must cite real record ids;
 * uncited claims are dropped in validation. No AI runs automatically.
 */

import type { EvidenceItem, StoreState, WeeklySynthesisData } from "@/types/mvp";
import { weeklySynthesis } from "@/lib/aiClient";
import { validateWeeklySynthesis } from "@/lib/formation/schema";

export interface WeeklyStats {
  beliefsAffirmed: number;
  beliefsRevised: number;
  beliefsQuestioned: number;
  newSources: number;
  comparisonsCompleted: number;
  inquiriesCompleted: number;
  inquiriesUnresolved: number;
  threadsChanged: number;
  reflectionsWritten: number;
  practicesAccepted: number;
  recurringConcepts: string[];
  unresolvedTensions: string[];
  changesFromLastWeek: string[];
}

function inWindow(iso: string | undefined, startMs: number, endMs: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= startMs && t < endMs;
}

function countBeliefJudgments(state: StoreState, startMs: number, endMs: number) {
  let affirmed = 0, revised = 0, questioned = 0;
  for (const b of state.beliefs) {
    for (const j of b.judgments) {
      if (!inWindow(j.at, startMs, endMs)) continue;
      if (j.decision === "accepted" || j.decision === "reaffirmed") affirmed++;
      else if (j.decision === "rewritten") revised++;
      else if (j.decision === "questioned") questioned++;
    }
  }
  return { affirmed, revised, questioned };
}

function statsFor(state: StoreState, startMs: number, endMs: number): WeeklyStats {
  const j = countBeliefJudgments(state, startMs, endMs);
  const conceptCounts = new Map<string, number>();
  for (const s of state.sources) {
    if (!inWindow(s.addedAt, startMs, endMs)) continue;
    for (const c of s.keyConcepts ?? []) conceptCounts.set(c, (conceptCounts.get(c) ?? 0) + 1);
  }
  for (const b of state.beliefs) {
    if (b.theme && inWindow(b.updatedAt, startMs, endMs)) conceptCounts.set(b.theme, (conceptCounts.get(b.theme) ?? 0) + 1);
  }
  const recurringConcepts = [...conceptCounts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([c]) => c);

  const unresolvedTensions = [
    ...state.inquiries.filter((i) => i.status === "unresolved").map((i) => i.question),
    ...state.megathreads.flatMap((t) => t.unresolvedQuestions.filter((q) => !q.resolved).map((q) => q.text)),
  ].slice(0, 8);

  return {
    beliefsAffirmed: j.affirmed,
    beliefsRevised: j.revised,
    beliefsQuestioned: j.questioned,
    newSources: state.sources.filter((s) => inWindow(s.addedAt, startMs, endMs)).length,
    comparisonsCompleted: state.comparisons.filter((c) => inWindow(c.createdAt, startMs, endMs)).length,
    inquiriesCompleted: state.inquiries.filter((i) => i.status === "resolved" && inWindow(i.updatedAt, startMs, endMs)).length,
    inquiriesUnresolved: state.inquiries.filter((i) => i.status === "unresolved").length,
    threadsChanged: state.megathreads.filter((t) => inWindow(t.updatedAt, startMs, endMs)).length,
    reflectionsWritten: state.reflections.filter((r) => inWindow(r.createdAt, startMs, endMs)).length,
    practicesAccepted: state.practices.filter((p) => p.status === "accepted" && inWindow(p.updatedAt, startMs, endMs)).length,
    recurringConcepts,
    unresolvedTensions,
    changesFromLastWeek: [],
  };
}

/** Deterministic weekly counts + week-over-week deltas. */
export function buildWeeklyStats(state: StoreState, days = 7): WeeklyStats {
  const now = Date.now();
  const start = now - days * 86_400_000;
  const prevStart = start - days * 86_400_000;
  const cur = statsFor(state, start, now);
  const prev = statsFor(state, prevStart, start);

  const delta = (label: string, a: number, b: number) => {
    const d = a - b;
    if (d === 0) return null;
    return `${Math.abs(d)} ${d > 0 ? "more" : "fewer"} ${label} than last week`;
  };
  cur.changesFromLastWeek = [
    delta("sources", cur.newSources, prev.newSources),
    delta("beliefs revised", cur.beliefsRevised, prev.beliefsRevised),
    delta("reflections", cur.reflectionsWritten, prev.reflectionsWritten),
    delta("comparisons", cur.comparisonsCompleted, prev.comparisonsCompleted),
  ].filter((x): x is string => x !== null);
  return cur;
}

/** Evidence packet for the weekly narrative — evidence ids ARE real record ids. */
export function weeklyEvidence(state: StoreState, days = 7): EvidenceItem[] {
  const now = Date.now();
  const start = now - days * 86_400_000;
  const out: EvidenceItem[] = [];
  const inW = (iso?: string) => inWindow(iso, start, now);

  for (const b of state.beliefs) {
    if (b.judgments.some((j) => inW(j.at)) || inW(b.updatedAt)) {
      out.push({ id: b.id, kind: "belief", group: "Belief", text: `${b.text} (${b.status})` });
    }
  }
  for (const s of state.sources) if (inW(s.addedAt)) out.push({ id: s.id, kind: "metadata", group: "Source", text: s.title });
  for (const c of state.comparisons) if (inW(c.createdAt)) out.push({ id: c.id, kind: "comparison_finding", group: "Comparison", text: c.title });
  for (const i of state.inquiries) if (inW(i.updatedAt)) out.push({ id: i.id, kind: "comparison_finding", group: "Inquiry", text: `${i.question} (${i.status})` });
  for (const t of state.megathreads) if (inW(t.updatedAt)) out.push({ id: t.id, kind: "metadata", group: "Thread", text: t.title });
  for (const r of state.reflections) if (inW(r.createdAt)) out.push({ id: r.id, kind: "belief", group: "Reflection", text: r.response.slice(0, 160) });
  return out.slice(0, 50);
}

export function estimateWeekly(state: StoreState): { calls: number; evidenceCount: number } {
  return { calls: 1, evidenceCount: weeklyEvidence(state).length };
}

/** Run one weekly narrative synthesis over the week's records. */
export async function runWeeklySynthesis(
  state: StoreState,
): Promise<{ synthesis: WeeklySynthesisData; source: "ai" | "mock" }> {
  const stats = buildWeeklyStats(state);
  const evidence = weeklyEvidence(state);
  const validIds = new Set(evidence.map((e) => e.id));
  const summary = `${stats.beliefsAffirmed} affirmed, ${stats.beliefsRevised} revised, ${stats.beliefsQuestioned} questioned; ${stats.newSources} new sources; ${stats.comparisonsCompleted} comparisons; ${stats.reflectionsWritten} reflections; ${stats.practicesAccepted} practices accepted.`;
  const { result: raw, source } = await weeklySynthesis({ evidence, summary });
  const synthesis = validateWeeklySynthesis(raw, validIds, { narrative: summary });
  // Deterministic fields always reflect the real counts.
  synthesis.recurringConcepts = stats.recurringConcepts;
  synthesis.unresolvedTensions = stats.unresolvedTensions;
  synthesis.changesFromLastWeek = stats.changesFromLastWeek;
  return { synthesis, source };
}
