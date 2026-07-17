"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import type { Concept } from "@/types/mvp";
import {
  conceptById,
  markConceptReviewed,
  setConceptFields,
  setConceptStatus,
  toggleConceptLink,
  toggleConceptPrinciple,
  useStore,
} from "@/lib/mvpStore";
import { conceptDeps } from "@/lib/freshness/fingerprint";
import ConceptRelationships from "@/components/ConceptRelationships";
import FreshnessBadge from "@/components/FreshnessBadge";

const STATUSES: Concept["status"][] = ["proposed", "active", "archived", "merged"];

function snippet(s: string, n = 60): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}
function lines(s: string): string[] {
  return s.split("\n").map((x) => x.trim()).filter(Boolean);
}

type LinkField = "relatedBeliefs" | "relatedThreads" | "relatedSources" | "relatedPractices";

function LinkToggles({
  conceptId, field, selected, items, label,
}: {
  conceptId: string;
  field: LinkField;
  selected: string[];
  items: { id: string; label: string }[];
  label: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <button key={it.id} type="button" onClick={() => toggleConceptLink(conceptId, field, it.id)} className={`rounded-full px-2.5 py-1 text-[11px] ${selected.includes(it.id) ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-black/[.12] text-zinc-500 dark:border-white/[.15]"}`}>
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ConceptPage() {
  const { id } = useParams<{ id: string }>();
  const state = useStore();
  const concept = useMemo(() => conceptById(state, id), [state, id]);

  if (!concept) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-zinc-600 dark:text-zinc-300">Concept not found.</p>
        <Link href="/world" className="text-sm text-zinc-500 underline-offset-4 hover:underline">← Back to World</Link>
      </main>
    );
  }
  const c: Concept = concept;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link href="/world" className="text-sm text-zinc-400 underline-offset-4 hover:underline">← World</Link>

      <header className="mb-6 mt-3">
        <input
          defaultValue={c.name}
          onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && setConceptFields(c.id, { name: e.target.value.trim() })}
          className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STATUSES.map((st) => (
            <button key={st} type="button" onClick={() => setConceptStatus(c.id, st)} className={`rounded-full px-2.5 py-1 text-[11px] ${c.status === st ? "bg-black/[.06] font-medium dark:bg-white/[.10]" : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`}>{st}</button>
          ))}
        </div>
      </header>

      <div className="mb-6">
        <FreshnessBadge state={state} fingerprint={c.fingerprint} currentIds={conceptDeps(c)} onRerun={() => markConceptReviewed(c.id)} approxAiCalls={0} />
        <p className="mt-1 text-[11px] text-zinc-400">“Re-run” here just records that you&apos;ve reviewed the concept against its current links — no AI call.</p>
      </div>

      {/* Definition + description */}
      <section className="mb-8 flex flex-col gap-4">
        <div>
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Definition</h2>
          <textarea defaultValue={c.definition} onBlur={(e) => e.target.value.trim() !== c.definition && setConceptFields(c.id, { definition: e.target.value.trim() })} rows={2} placeholder="A concise definition…" className="w-full resize-none rounded-lg border border-black/[.10] bg-transparent p-2.5 text-sm outline-none dark:border-white/[.12]" />
        </div>
        <div>
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Description</h2>
          <textarea defaultValue={c.description} onBlur={(e) => e.target.value.trim() !== c.description && setConceptFields(c.id, { description: e.target.value.trim() })} rows={3} placeholder="Fuller notes, nuance, context…" className="w-full resize-none rounded-lg border border-black/[.10] bg-transparent p-2.5 text-sm outline-none dark:border-white/[.12]" />
        </div>
        <div>
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Aliases</h2>
          <input defaultValue={c.aliases.join(", ")} onBlur={(e) => setConceptFields(c.id, { aliases: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="Other names, comma-separated" className="w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none dark:border-white/[.12]" />
        </div>
      </section>

      {/* Relationships */}
      <section className="mb-8">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Relationships</h2>
        <ConceptRelationships concept={c} />
      </section>

      {/* Cross-type links */}
      <section className="mb-8 flex flex-col gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Grounded in your records</h2>
        <LinkToggles conceptId={c.id} selected={c.relatedBeliefs} field="relatedBeliefs" label="Beliefs" items={state.beliefs.filter((b) => b.status !== "rejected").map((b) => ({ id: b.id, label: snippet(b.text, 36) }))} />
        <LinkToggles conceptId={c.id} selected={c.relatedThreads} field="relatedThreads" label="Threads" items={state.megathreads.map((t) => ({ id: t.id, label: snippet(t.title, 32) }))} />
        <LinkToggles conceptId={c.id} selected={c.relatedSources} field="relatedSources" label="Sources" items={state.sources.map((s) => ({ id: s.id, label: snippet(s.title, 32) }))} />
        <LinkToggles conceptId={c.id} selected={c.relatedPractices} field="relatedPractices" label="Practices" items={state.practices.filter((p) => p.status === "accepted").map((p) => ({ id: p.id, label: snippet(p.userWording || p.title, 32) }))} />
      </section>

      {/* Principles */}
      {state.principles.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Principles</h2>
          <div className="flex flex-wrap gap-1.5">
            {state.principles.map((p) => (
              <button key={p.id} type="button" onClick={() => toggleConceptPrinciple(c.id, p.id)} className={`rounded-full px-2.5 py-1 text-[11px] ${c.principleIds.includes(p.id) ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-black/[.12] text-zinc-500 dark:border-white/[.15]"}`}>
                {snippet(p.statement, 40)}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Open questions */}
      <section className="mb-8">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Open questions</h2>
        <textarea defaultValue={c.questions.join("\n")} onBlur={(e) => setConceptFields(c.id, { questions: lines(e.target.value) })} rows={2} placeholder="Questions this concept raises (one per line)…" className="w-full resize-none rounded-lg border border-black/[.10] bg-transparent p-2.5 text-sm outline-none dark:border-white/[.12]" />
      </section>

      {/* History */}
      {c.history.length > 0 && (
        <section className="text-xs text-zinc-400">
          <h2 className="mb-1 font-semibold uppercase tracking-wide">History</h2>
          <ul className="flex flex-col gap-0.5">
            {[...c.history].reverse().slice(0, 20).map((h, i) => (
              <li key={i}>{new Date(h.at).toLocaleDateString()} — {h.note}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
