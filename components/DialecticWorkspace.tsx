"use client";

import { useMemo, useState } from "react";
import type { DialecticTensionKind, DialogueSession } from "@/types/mvp";
import { addTension, detectTensionsFor, useStore } from "@/lib/mvpStore";
import { buildDialecticMemory } from "@/lib/dialectic/memory";
import TensionCard from "@/components/TensionCard";

const KINDS: { value: DialecticTensionKind; label: string }[] = [
  { value: "conflicting_beliefs", label: "Conflicting beliefs" },
  { value: "incompatible_assumptions", label: "Incompatible assumptions" },
  { value: "unresolved_paradox", label: "Unresolved paradox" },
  { value: "competing_values", label: "Competing values" },
  { value: "empirical_disagreement", label: "Empirical disagreement" },
  { value: "logical_inconsistency", label: "Logical inconsistency" },
  { value: "definition_mismatch", label: "Definition mismatch" },
];

export default function DialecticWorkspace({ session }: { session: DialogueSession }) {
  const state = useStore();
  const tensions = useMemo(
    () => state.tensions.filter((t) => t.dialogueId === session.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [state.tensions, session.id],
  );
  const memory = useMemo(() => buildDialecticMemory(state, session.id), [state, session.id]);
  const [detectNote, setDetectNote] = useState<string | null>(null);
  const [showAuthor, setShowAuthor] = useState(false);
  const [form, setForm] = useState({ kind: "conflicting_beliefs" as DialecticTensionKind, title: "", thesis: "", antithesis: "" });

  function runDetect() {
    const n = detectTensionsFor(session.id);
    setDetectNote(n === 0 ? "No new tensions from explicit signals. You can author one below." : `Found ${n} new tension${n === 1 ? "" : "s"}.`);
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-2xl border border-black/[.06] p-4 dark:border-white/[.08]">
        <p className="text-xs text-zinc-500">
          The dialectical engine surfaces tensions between your beliefs, assumptions, evidence and perspectives — from
          explicit signals only — and helps you build increasingly coherent syntheses. The goal is not debate or winning;
          it is the progressive refinement of understanding. Uncertainty is preserved wherever it is justified.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={runDetect} className="rounded-full border border-black/[.12] px-4 py-2 text-sm hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]">Detect tensions</button>
          <button type="button" onClick={() => setShowAuthor((v) => !v)} className="rounded-full border border-black/[.12] px-3 py-1.5 text-xs dark:border-white/[.15]">{showAuthor ? "− " : "+ "}Author a tension</button>
          {detectNote && <span className="text-xs text-zinc-500">{detectNote}</span>}
        </div>
        {showAuthor && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-dashed border-black/[.12] p-3 dark:border-white/[.15]">
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as DialecticTensionKind })} className="rounded-lg border border-black/[.10] bg-transparent px-2 py-1.5 text-xs outline-none dark:border-white/[.12]">
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Short title…" className="rounded-lg border border-black/[.10] bg-transparent px-2 py-1.5 text-sm outline-none dark:border-white/[.12]" />
            <input value={form.thesis} onChange={(e) => setForm({ ...form, thesis: e.target.value })} placeholder="Thesis…" className="rounded-lg border border-black/[.10] bg-transparent px-2 py-1.5 text-sm outline-none dark:border-white/[.12]" />
            <input value={form.antithesis} onChange={(e) => setForm({ ...form, antithesis: e.target.value })} placeholder="Antithesis…" className="rounded-lg border border-black/[.10] bg-transparent px-2 py-1.5 text-sm outline-none dark:border-white/[.12]" />
            <button type="button" onClick={() => { if (form.thesis.trim() && form.antithesis.trim()) { addTension(session.id, form); setForm({ kind: "conflicting_beliefs", title: "", thesis: "", antithesis: "" }); setShowAuthor(false); } }} disabled={!form.thesis.trim() || !form.antithesis.trim()} className="self-start rounded-full border border-black/[.12] px-3 py-1.5 text-xs disabled:opacity-30 dark:border-white/[.15]">Add tension</button>
          </div>
        )}
      </div>

      {/* Conversation memory */}
      {(memory.previousSyntheses.length > 0 || memory.abandonedSyntheses.length > 0 || memory.recurringConflicts.length > 0) && (
        <div className="grid gap-3 rounded-2xl border border-black/[.06] p-4 text-xs dark:border-white/[.08] sm:grid-cols-2">
          <h3 className="col-span-full text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Memory</h3>
          <MemoryStat label="Accepted syntheses" value={memory.previousSyntheses.length} tone="text-emerald-600 dark:text-emerald-400" />
          <MemoryStat label="Abandoned syntheses" value={memory.abandonedSyntheses.length} tone="text-zinc-400" />
          <MemoryStat label="Unresolved tensions" value={memory.unresolvedTensions.length} tone="text-amber-600 dark:text-amber-400" />
          <MemoryStat label="Recurring conflicts" value={memory.recurringConflicts.length} tone="text-indigo-600 dark:text-indigo-400" />
          {memory.recurringConflicts.length > 0 && (
            <p className="col-span-full text-[11px] text-zinc-500">
              Recurring across tensions: {memory.recurringConflicts.map((r) => r.label).join(", ")}
            </p>
          )}
        </div>
      )}

      {tensions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/[.10] p-5 text-sm text-zinc-500 dark:border-white/[.12]">
          No tensions yet. Run detection to surface them from your beliefs, concepts, perspectives and evidence — or author one directly.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {tensions.map((t) => <TensionCard key={t.id} tension={t} />)}
        </div>
      )}
    </section>
  );
}

function MemoryStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-black/[.02] px-2.5 py-1.5 dark:bg-white/[.03]">
      <span className="text-zinc-500">{label}</span>
      <span className={`text-sm font-semibold ${tone}`}>{value}</span>
    </div>
  );
}
