"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { RecordType, SourceType } from "@/types/mvp";
import { searchSources, useStore } from "@/lib/mvpStore";
import { PROCESSING_LABELS, SOURCE_TYPE_LABELS, isProcessing } from "@/lib/labels";
import { buildRecords } from "@/lib/retrieval/records";
import { search } from "@/lib/retrieval/search";
import AddSource from "@/components/AddSource";
import RetrievalResults from "@/components/RetrievalResults";
import SemanticIndexPanel from "@/components/SemanticIndexPanel";

const GROUP_LABELS: Partial<Record<RecordType, string>> = {
  source: "Sources",
  summary: "Summaries",
  quote: "Quotes",
  concept: "Concepts",
  chunk: "Passages",
  belief: "Beliefs",
  proposal: "Candidate beliefs",
  capture: "Captures",
  revision: "Earlier versions",
};
const GROUP_ORDER: RecordType[] = [
  "source", "summary", "quote", "concept", "chunk", "belief", "proposal", "capture", "revision",
];

export default function LibraryPage() {
  const state = useStore();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<SourceType | "all">("all");
  const [showAdd, setShowAdd] = useState(false);

  const sources = searchSources(state, query, typeFilter);
  const presentTypes = [...new Set(state.sources.map((s) => s.type))];

  const records = useMemo(() => buildRecords(state), [state]);
  const deepQuery = query.trim().length >= 2;
  const results = useMemo(
    () => (deepQuery ? search(query, records, state.feedback, { limit: 30, maxPerSource: 3, semantic: state.embeddings.length > 0 }) : []),
    [deepQuery, query, records, state.feedback, state.embeddings.length],
  );
  const grouped = useMemo(() => {
    const m = new Map<RecordType, typeof results>();
    for (const r of results) {
      const arr = m.get(r.record.type) ?? [];
      arr.push(r);
      m.set(r.record.type, arr);
    }
    return m;
  }, [results]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {state.sources.length} source{state.sources.length === 1 ? "" : "s"} —
            the material your beliefs are formed from.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {state.sources.length >= 2 && (
            <Link
              href="/compare"
              className="rounded-full border border-black/[.12] px-4 py-2 text-sm font-medium hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]"
            >
              Compare
            </Link>
          )}
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {showAdd ? "Close" : "Add source"}
          </button>
        </div>
      </header>

      {showAdd && (
        <div className="mb-8">
          <AddSource />
        </div>
      )}

      {state.sources.length > 0 && <SemanticIndexPanel state={state} />}

      {state.sources.length > 0 && (
        <div className="mb-6 flex flex-col gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search everything — titles, text, quotes, concepts, beliefs…"
            className="w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]"
          />
          {!deepQuery && (
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
                All
              </FilterChip>
              {presentTypes.map((t) => (
                <FilterChip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
                  {SOURCE_TYPE_LABELS[t]}
                </FilterChip>
              ))}
            </div>
          )}
        </div>
      )}

      {deepQuery && (
        <div className="mb-6">
          {results.length === 0 ? (
            <p className="text-sm text-zinc-400">Nothing found for “{query.trim()}”.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {GROUP_ORDER.filter((t) => grouped.has(t)).map((t) => (
                <section key={t}>
                  <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    {GROUP_LABELS[t]}
                  </h2>
                  <RetrievalResults results={grouped.get(t)!} />
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {state.sources.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/[.10] p-10 text-center dark:border-white/[.12]">
          <p className="text-zinc-500">Your library is empty.</p>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="mt-3 text-sm text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
          >
            Add your first source →
          </button>
        </div>
      ) : deepQuery ? null : (
        <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
          {sources.map((s) => (
            <li key={s.id}>
              <Link href={`/library/${s.id}`} className="flex items-start gap-3 py-4">
                <span className="mt-0.5 rounded-md bg-black/[.05] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-white/[.08]">
                  {SOURCE_TYPE_LABELS[s.type]}
                </span>
                <span className="flex-1">
                  <span className="block font-medium text-zinc-900 dark:text-zinc-100">
                    {s.title}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
                    {s.author && <span>{s.author}</span>}
                    <span>
                      {isProcessing(s.processingState) && "⏳ "}
                      {PROCESSING_LABELS[s.processingState]}
                    </span>
                    <span>· added {new Date(s.addedAt).toLocaleDateString()}</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs transition-colors ${
        active
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "border border-black/[.10] text-zinc-500 hover:text-zinc-900 dark:border-white/[.12] dark:hover:text-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}
