"use client";

import Link from "next/link";
import { useState } from "react";
import type { SourceType } from "@/types/mvp";
import { searchSources, useStore } from "@/lib/mvpStore";
import { PROCESSING_LABELS, SOURCE_TYPE_LABELS, isProcessing } from "@/lib/labels";
import AddSource from "@/components/AddSource";

export default function LibraryPage() {
  const state = useStore();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<SourceType | "all">("all");
  const [showAdd, setShowAdd] = useState(false);

  const sources = searchSources(state, query, typeFilter);
  const presentTypes = [...new Set(state.sources.map((s) => s.type))];

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
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {showAdd ? "Close" : "Add source"}
        </button>
      </header>

      {showAdd && (
        <div className="mb-8">
          <AddSource />
        </div>
      )}

      {state.sources.length > 0 && (
        <div className="mb-6 flex flex-col gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles and authors…"
            className="w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]"
          />
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
      ) : sources.length === 0 ? (
        <p className="text-sm text-zinc-400">No sources match your search.</p>
      ) : (
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
