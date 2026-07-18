"use client";

import { useMemo, useState } from "react";
import type { DialogueSession, DialogueTurnKind } from "@/types/mvp";
import { addDialogueTurn, removeDialogueTurn, toggleDialogueTurnFlag, useStore } from "@/lib/mvpStore";
import { buildGraph, lookup } from "@/lib/graph";

const TURN_KINDS: DialogueTurnKind[] = ["response", "question", "challenge", "clarification", "counterargument", "evidence", "reflection", "summary"];

const KIND_COLOR: Record<string, string> = {
  question: "border-sky-400", response: "border-zinc-300", challenge: "border-rose-400",
  clarification: "border-emerald-400", counterargument: "border-amber-400", evidence: "border-teal-400",
  reflection: "border-violet-400", summary: "border-indigo-400",
};
const FLAGS: { flag: "insight" | "new_question" | "dead_end"; label: string }[] = [
  { flag: "insight", label: "Insight" }, { flag: "new_question", label: "New question" }, { flag: "dead_end", label: "Dead end" },
];

export default function DialogueThread({ session }: { session: DialogueSession }) {
  const state = useStore();
  const graph = useMemo(() => buildGraph(state), [state]);
  const [kind, setKind] = useState<DialogueTurnKind>("response");
  const [text, setText] = useState("");
  const [cites, setCites] = useState<string[]>([]);

  // Records available to cite: this dialogue's anchors + everything cited so far.
  const citeOptions = useMemo(() => {
    const ids = new Set<string>([...session.seedRefs, ...session.turns.flatMap((t) => t.citations), ...session.participants.map((p) => p.refId).filter((x): x is string => Boolean(x))]);
    return [...ids].map((id) => lookup(graph, id)).filter((n): n is NonNullable<typeof n> => !!n);
  }, [session, graph]);

  function add() {
    if (!text.trim()) return;
    addDialogueTurn(session.id, { kind, text, author: "you", citations: cites });
    setText(""); setCites([]);
  }

  return (
    <div className="flex flex-col gap-4">
      {session.turns.length > 0 && (
        <ul className="flex flex-col gap-3">
          {session.turns.map((t) => (
            <li key={t.id} className={`rounded-lg border-l-2 ${KIND_COLOR[t.kind] ?? "border-zinc-300"} border-y border-r border-black/[.06] p-3 dark:border-white/[.08]`}>
              <div className="flex items-start justify-between gap-3">
                <p className="flex-1 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                  <span className="text-[10px] uppercase tracking-wide text-zinc-400">{t.kind.replace(/_/g, " ")}{t.author !== "you" ? ` · ${t.author}` : ""} — </span>
                  {t.text}
                </p>
                <button type="button" onClick={() => removeDialogueTurn(session.id, t.id)} className="shrink-0 text-[11px] text-zinc-400 hover:text-red-500">remove</button>
              </div>
              {t.citations.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {t.citations.map((cid) => {
                    const n = lookup(graph, cid);
                    return n ? <span key={cid} className="inline-flex items-center gap-1 rounded bg-black/[.05] px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-white/[.08]"><span className="font-mono text-[10px] text-zinc-400">{n.kind}</span>{n.label}</span> : null;
                  })}
                </div>
              )}
              <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                {FLAGS.map(({ flag, label }) => (
                  <button key={flag} type="button" onClick={() => toggleDialogueTurnFlag(session.id, t.id, flag)} className={`rounded-full px-2 py-0.5 ${t.flags.includes(flag) ? "bg-black/[.06] font-medium text-zinc-700 dark:bg-white/[.10] dark:text-zinc-200" : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`}>{label}</button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add a turn */}
      <div className="rounded-2xl border border-black/[.06] p-4 dark:border-white/[.08]">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {TURN_KINDS.map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full px-2.5 py-1 text-[11px] ${kind === k ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-black/[.12] text-zinc-500 dark:border-white/[.15]"}`}>{k.replace(/_/g, " ")}</button>
          ))}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={`Write your ${kind}…`} className="w-full resize-none rounded-lg border border-black/[.12] bg-transparent p-2.5 text-sm outline-none dark:border-white/[.15]" />
        {citeOptions.length > 0 && (
          <div className="mt-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Cite evidence</p>
            <div className="flex flex-wrap gap-1.5">
              {citeOptions.map((n) => (
                <button key={n.id} type="button" onClick={() => setCites((c) => c.includes(n.id) ? c.filter((x) => x !== n.id) : [...c, n.id])} className={`rounded-full px-2 py-0.5 text-[11px] ${cites.includes(n.id) ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-black/[.12] text-zinc-500 dark:border-white/[.15]"}`}>{n.label}</button>
              ))}
            </div>
          </div>
        )}
        <button type="button" onClick={add} disabled={!text.trim()} className="mt-2 rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900">Add turn</button>
      </div>
    </div>
  );
}
