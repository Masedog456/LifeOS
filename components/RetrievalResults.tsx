"use client";

import Link from "next/link";
import { recordFeedback } from "@/lib/mvpStore";
import type { RankedResult } from "@/lib/retrieval/search";
import type { RecordType } from "@/types/mvp";

const TYPE_LABEL: Record<RecordType, string> = {
  source: "Source",
  chunk: "Passage",
  summary: "Summary",
  concept: "Concept",
  quote: "Quote",
  capture: "Capture",
  proposal: "Candidate belief",
  belief: "Belief",
  revision: "Earlier version",
};

function truncate(s: string, n = 220): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

/**
 * Renders retrieval results with provenance (type · source · page) and a
 * "why it matched" reason — never a raw score. Optional feedback controls
 * feed deterministic ranking only.
 */
export default function RetrievalResults({
  results,
  showFeedback = true,
  label,
}: {
  results: RankedResult[];
  showFeedback?: boolean;
  /** Override the "why it matched" reason with a contextual label. */
  label?: (r: RankedResult) => string;
}) {
  if (results.length === 0) return null;
  return (
    <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
      {results.map((result) => {
        const { record, reason } = result;
        return (
        <li key={record.id} className="py-3">
          <Link
            href={record.href ?? "#"}
            className="block text-sm leading-relaxed text-zinc-800 hover:underline dark:text-zinc-200"
          >
            {truncate(record.text)}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
            <span className="rounded bg-black/[.05] px-1.5 py-0.5 dark:bg-white/[.08]">
              {TYPE_LABEL[record.type]}
            </span>
            {record.title && record.type !== "source" && <span>{record.title}</span>}
            {record.page != null && <span>p. {record.page}</span>}
            {record.status && <span>· {record.status}</span>}
            <span className="text-zinc-500 dark:text-zinc-400">· {label ? label(result) : reason}</span>
          </div>
          {showFeedback && (
            <div className="mt-1.5 flex gap-2 text-[11px] text-zinc-400">
              <button type="button" onClick={() => recordFeedback(record.id, "relevant")} className="hover:text-emerald-600">
                Relevant
              </button>
              <button type="button" onClick={() => recordFeedback(record.id, "not_relevant")} className="hover:text-zinc-700 dark:hover:text-zinc-200">
                Not relevant
              </button>
              <button type="button" onClick={() => recordFeedback(record.id, "dismissed")} className="hover:text-zinc-700 dark:hover:text-zinc-200">
                Dismiss
              </button>
              <button type="button" onClick={() => recordFeedback(record.id, "snoozed", 60 * 24 * 7)} className="hover:text-zinc-700 dark:hover:text-zinc-200">
                Snooze
              </button>
            </div>
          )}
        </li>
        );
      })}
    </ul>
  );
}
