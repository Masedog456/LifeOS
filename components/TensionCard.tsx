"use client";

import { useState } from "react";
import type { Tension, TensionStatus } from "@/types/mvp";
import { removeTension, setTensionStatus, useStore } from "@/lib/mvpStore";
import ConfidenceMeter from "@/components/ConfidenceMeter";
import SynthesisPanel from "@/components/SynthesisPanel";

const KIND_LABEL: Record<Tension["kind"], string> = {
  conflicting_beliefs: "Conflicting beliefs",
  incompatible_assumptions: "Incompatible assumptions",
  unresolved_paradox: "Unresolved paradox",
  competing_values: "Competing values",
  empirical_disagreement: "Empirical disagreement",
  logical_inconsistency: "Logical inconsistency",
  definition_mismatch: "Definition mismatch",
};

const STATUS_TONE: Record<TensionStatus, string> = {
  open: "bg-amber-400",
  under_synthesis: "bg-sky-400",
  resolved: "bg-emerald-400",
  dissolved: "bg-zinc-400",
  accepted_as_paradox: "bg-indigo-400",
};

const STATUSES: TensionStatus[] = ["open", "under_synthesis", "resolved", "dissolved", "accepted_as_paradox"];

function Pole({ label, text, refs, tone }: { label: string; text: string; refs: { refId: string; label: string }[]; tone: string }) {
  return (
    <div className={`rounded-xl border-l-2 ${tone} bg-black/[.02] p-2.5 dark:bg-white/[.03]`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-100">{text}</p>
      {refs.length > 0 && (
        <p className="mt-1 flex flex-wrap gap-1">
          {refs.map((r) => (
            <span key={r.refId} className="rounded-full bg-black/[.05] px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-white/[.06]" title={r.refId}>{r.label}</span>
          ))}
        </p>
      )}
    </div>
  );
}

export default function TensionCard({ tension }: { tension: Tension }) {
  const [open, setOpen] = useState(false);
  useStore(); // re-render on store changes (status/syntheses)

  const thesisEvidence = tension.evidence.filter((e) => e.stance === "supports_thesis");
  const antithesisEvidence = tension.evidence.filter((e) => e.stance === "supports_antithesis");

  return (
    <div className="rounded-2xl border border-black/[.08] p-4 dark:border-white/[.10]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-start justify-between gap-3 text-left">
        <span>
          <span className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${STATUS_TONE[tension.status]}`} />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{KIND_LABEL[tension.kind]}</span>
            <span className="text-[10px] text-zinc-400">· {tension.origin === "user" ? "yours" : "detected"}</span>
          </span>
          <span className="mt-0.5 block text-sm font-medium text-zinc-800 dark:text-zinc-100">{tension.title}</span>
        </span>
        <span className="mt-0.5 shrink-0 text-xs text-zinc-400">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Pole label="Thesis" text={tension.thesis} refs={thesisEvidence} tone="border-sky-400" />
            <Pole label="Antithesis" text={tension.antithesis} refs={antithesisEvidence} tone="border-rose-400" />
          </div>

          {tension.detail && (
            <p className="rounded-lg bg-black/[.02] px-2.5 py-1.5 text-[11px] text-zinc-500 dark:bg-white/[.03]">
              <span className="font-semibold">Why flagged: </span>{tension.detail}
            </p>
          )}

          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Confidence (four axes, never averaged)</p>
            <ConfidenceMeter confidence={tension.confidence} />
          </div>

          {tension.unresolvedQuestions.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Unresolved questions</p>
              <ul className="mt-0.5 list-disc pl-4 text-xs text-zinc-600 dark:text-zinc-300">
                {tension.unresolvedQuestions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-zinc-400">Status:</span>
            {STATUSES.map((st) => (
              <button key={st} type="button" onClick={() => setTensionStatus(tension.id, st)} className={`rounded-full px-2 py-0.5 text-[10px] ${tension.status === st ? "bg-black/[.06] font-medium dark:bg-white/[.10]" : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`}>{st.replace(/_/g, " ")}</button>
            ))}
            <button type="button" onClick={() => removeTension(tension.id)} className="ml-auto text-[11px] text-zinc-400 hover:text-red-500">remove</button>
          </div>

          <SynthesisPanel tension={tension} />
        </div>
      )}
    </div>
  );
}
