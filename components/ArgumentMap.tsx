"use client";

import { useMemo, useState } from "react";
import type { ArgumentEdgeKind, ArgumentNodeKind, ProjectEvidence, ResearchProject } from "@/types/mvp";
import { addArgumentEdge, addArgumentNode, removeArgumentEdge, removeArgumentNode } from "@/lib/mvpStore";

const NODE_KINDS: ArgumentNodeKind[] = ["claim", "evidence", "counterargument", "objection", "rebuttal", "open_question", "unknown"];
const EDGE_KINDS: ArgumentEdgeKind[] = ["supports", "contradicts", "objects_to", "rebuts", "answers", "raises", "depends_on"];

const NODE_COLOR: Record<ArgumentNodeKind, string> = {
  claim: "border-sky-400", evidence: "border-emerald-400", counterargument: "border-rose-400",
  objection: "border-amber-400", rebuttal: "border-violet-400", open_question: "border-zinc-400", unknown: "border-zinc-300",
};

function label(s: string, n = 40): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

/** An explicit, user-authored argument map. Every node and edge is created by
 *  the user — nothing is inferred silently. */
export default function ArgumentMap({ project, evidence }: { project: ResearchProject; evidence: ProjectEvidence[] }) {
  const [kind, setKind] = useState<ArgumentNodeKind>("claim");
  const [text, setText] = useState("");
  const [recordId, setRecordId] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [edgeKind, setEdgeKind] = useState<ArgumentEdgeKind>("supports");

  const byId = useMemo(() => new Map(project.argumentNodes.map((n) => [n.id, n])), [project.argumentNodes]);

  function add() {
    if (kind === "evidence" ? !recordId : !text.trim()) return;
    const evidenceLabel = kind === "evidence" ? (evidence.find((e) => e.id === recordId)?.label ?? "evidence") : text;
    addArgumentNode(project.id, kind, evidenceLabel, kind === "evidence" ? recordId : undefined);
    setText(""); setRecordId("");
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Add a node */}
      <div className="rounded-2xl border border-black/[.06] p-4 dark:border-white/[.08]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Add a node</p>
        <div className="flex flex-wrap gap-1.5">
          {NODE_KINDS.map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full px-2.5 py-1 text-[11px] ${kind === k ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-black/[.12] text-zinc-500 dark:border-white/[.15]"}`}>{k.replace(/_/g, " ")}</button>
          ))}
        </div>
        {kind === "evidence" ? (
          <select value={recordId} onChange={(e) => setRecordId(e.target.value)} className="mt-2 w-full rounded-lg border border-black/[.12] bg-transparent px-3 py-2 text-sm outline-none dark:border-white/[.15]">
            <option value="">— choose an assembled record —</option>
            {evidence.map((e) => <option key={e.id} value={e.id}>{e.label} ({e.kind})</option>)}
          </select>
        ) : (
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Text of the ${kind.replace(/_/g, " ")}…`} className="mt-2 w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none dark:border-white/[.12]" />
        )}
        <button type="button" onClick={add} className="mt-2 rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">Add node</button>
      </div>

      {/* Nodes */}
      {project.argumentNodes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {project.argumentNodes.map((n) => (
            <li key={n.id} className={`flex items-start justify-between gap-3 rounded-lg border-l-2 ${NODE_COLOR[n.kind]} border-y border-r border-black/[.06] p-2.5 dark:border-white/[.08]`}>
              <span className="text-sm text-zinc-800 dark:text-zinc-200"><span className="text-[10px] uppercase tracking-wide text-zinc-400">{n.kind.replace(/_/g, " ")} · </span>{n.text}</span>
              <button type="button" onClick={() => removeArgumentNode(project.id, n.id)} className="shrink-0 text-[11px] text-zinc-400 hover:text-red-500">remove</button>
            </li>
          ))}
        </ul>
      )}

      {/* Add an edge */}
      {project.argumentNodes.length >= 2 && (
        <div className="rounded-2xl border border-black/[.06] p-4 dark:border-white/[.08]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Relate two nodes (you author every link)</p>
          <div className="flex flex-col gap-2">
            <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm outline-none dark:border-white/[.15]">
              <option value="">from…</option>
              {project.argumentNodes.map((n) => <option key={n.id} value={n.id}>{label(n.text)}</option>)}
            </select>
            <select value={edgeKind} onChange={(e) => setEdgeKind(e.target.value as ArgumentEdgeKind)} className="rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm outline-none dark:border-white/[.15]">
              {EDGE_KINDS.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
            </select>
            <select value={toId} onChange={(e) => setToId(e.target.value)} className="rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm outline-none dark:border-white/[.15]">
              <option value="">to…</option>
              {project.argumentNodes.map((n) => <option key={n.id} value={n.id}>{label(n.text)}</option>)}
            </select>
            <button type="button" onClick={() => { if (fromId && toId) { addArgumentEdge(project.id, fromId, toId, edgeKind); setFromId(""); setToId(""); } }} disabled={!fromId || !toId || fromId === toId} className="self-start rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900">Add link</button>
          </div>
        </div>
      )}

      {/* Edges */}
      {project.argumentEdges.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm">
          {project.argumentEdges.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3">
              <span className="text-zinc-700 dark:text-zinc-300">{label(byId.get(e.fromId)?.text ?? "?", 28)} <span className="text-zinc-400">{e.kind.replace(/_/g, " ")}</span> → {label(byId.get(e.toId)?.text ?? "?", 28)}</span>
              <button type="button" onClick={() => removeArgumentEdge(project.id, e.id)} className="shrink-0 text-[11px] text-zinc-400 hover:text-red-500">remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
