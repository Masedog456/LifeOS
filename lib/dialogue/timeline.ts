/**
 * Dialogue timeline (LIFEOS-022, Phase 8).
 *
 * A DERIVED, read-only, chronological view of a dialogue — its turns, major
 * insights, new questions, and dead ends (from the flags the user set on
 * turns), plus session/outcome events. Built fresh each render from the
 * append-only turn log; never stored, deduped by stable id.
 */

import type { DialogueSession, DialogueTimelineItem } from "@/types/mvp";

function snippet(s: string, n = 90): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

export function buildDialogueTimeline(session: DialogueSession): DialogueTimelineItem[] {
  const items: DialogueTimelineItem[] = [];
  items.push({ id: `s:${session.id}`, at: session.createdAt, kind: "session", title: `Dialogue opened: ${snippet(session.title, 60)}` });

  for (const t of session.turns) {
    items.push({ id: `t:${t.id}`, at: t.createdAt, kind: "turn", title: `${t.kind.replace(/_/g, " ")}: ${snippet(t.text)}`, detail: t.author === "you" ? undefined : `— ${t.author}` });
    if (t.flags.includes("insight")) items.push({ id: `i:${t.id}`, at: t.createdAt, kind: "insight", title: `Insight: ${snippet(t.text, 70)}` });
    if (t.flags.includes("new_question")) items.push({ id: `q:${t.id}`, at: t.createdAt, kind: "new_question", title: `New question: ${snippet(t.text, 70)}` });
    if (t.flags.includes("dead_end")) items.push({ id: `d:${t.id}`, at: t.createdAt, kind: "dead_end", title: `Dead end: ${snippet(t.text, 70)}` });
  }

  for (let i = 0; i < session.outcomes.length; i++) {
    const o = session.outcomes[i];
    items.push({ id: `o:${session.id}:${i}`, at: o.at, kind: "session", title: `Created ${o.kind}: ${snippet(o.label, 60)}` });
  }

  const seen = new Set<string>();
  return items
    .filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
