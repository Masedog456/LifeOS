"use client";

import { useMemo, useState } from "react";
import type { HypothesisStatus, ProjectEvidence, ResearchProject } from "@/types/mvp";
import {
  addHypothesis,
  removeHypothesis,
  setHypothesisFields,
  toggleHypothesisEvidence,
} from "@/lib/mvpStore";

const STATUSES: HypothesisStatus[] = ["proposed", "active", "supported", "weakened", "refuted", "abandoned"];
const CONFIDENCE: ("low" | "medium" | "high")[] = ["low", "medium", "high"];

function EvidenceToggles({ project, hid, side, label, evidence }: { project: ResearchProject; hid: string; side: "supporting" | "contradicting"; label: string; evidence: ProjectEvidence[] }) {
  const h = project.hypotheses.find((x) => x.id === hid)!;
  const chosen = side === "supporting" ? h.supportingEvidence : h.contradictingEvidence;
  if (evidence.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {evidence.map((e) => (
          <button key={e.id} type="button" onClick={() => toggleHypothesisEvidence(project.id, hid, side, e.id)} className={`rounded-full px-2 py-0.5 text-[11px] ${chosen.includes(e.id) ? (side === "supporting" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white") : "border border-black/[.12] text-zinc-500 dark:border-white/[.15]"}`}>
            {e.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Competing hypotheses. LifeOS never selects a winner — the user judges. */
export default function HypothesisList({ project, evidence }: { project: ResearchProject; evidence: ProjectEvidence[] }) {
  const [statement, setStatement] = useState("");
  const byId = useMemo(() => new Map(evidence.map((e) => [e.id, e])), [evidence]);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="Propose a hypothesis…" className="flex-1 rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none dark:border-white/[.12]" />
        <button type="button" onClick={() => { if (statement.trim()) { addHypothesis(project.id, statement); setStatement(""); } }} disabled={!statement.trim()} className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900">Add</button>
      </div>

      {project.hypotheses.length === 0 ? (
        <p className="text-sm text-zinc-500">No hypotheses yet. Propose one or more competing explanations — none is ever chosen for you.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {project.hypotheses.map((h) => (
            <li key={h.id} className="rounded-2xl border border-black/[.06] p-4 dark:border-white/[.08]">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{h.statement}</p>
                <button type="button" onClick={() => removeHypothesis(project.id, h.id)} className="shrink-0 text-[11px] text-zinc-400 hover:text-red-500">remove</button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
                <span>confidence:</span>
                {CONFIDENCE.map((c) => (
                  <button key={c} type="button" onClick={() => setHypothesisFields(project.id, h.id, { confidence: c })} className={`rounded-full px-2 py-0.5 ${h.confidence === c ? "bg-black/[.06] font-medium text-zinc-700 dark:bg-white/[.10] dark:text-zinc-200" : "hover:text-zinc-700 dark:hover:text-zinc-200"}`}>{c}</button>
                ))}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-400">
                <span>status:</span>
                {STATUSES.map((s) => (
                  <button key={s} type="button" onClick={() => setHypothesisFields(project.id, h.id, { status: s })} className={`rounded-full px-2 py-0.5 ${h.status === s ? "bg-black/[.06] font-medium text-zinc-700 dark:bg-white/[.10] dark:text-zinc-200" : "hover:text-zinc-700 dark:hover:text-zinc-200"}`}>{s}</button>
                ))}
              </div>
              <EvidenceToggles project={project} hid={h.id} side="supporting" label="Supporting evidence" evidence={evidence} />
              <EvidenceToggles project={project} hid={h.id} side="contradicting" label="Contradicting evidence" evidence={evidence} />
              {(h.supportingEvidence.length > 0 || h.contradictingEvidence.length > 0) && (
                <p className="mt-2 text-[11px] text-zinc-400">
                  {h.supportingEvidence.length} for · {h.contradictingEvidence.length} against
                  {h.supportingEvidence.filter((e) => byId.has(e)).length !== h.supportingEvidence.length && " (some evidence not in the current packet)"}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
