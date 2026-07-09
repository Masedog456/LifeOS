"use client";

import type { RevisionEntry } from "@/types/mvp";

/**
 * A small chronological "thread line" of a belief's revisions — CSS only,
 * no graph library, no canvas. The point is to *see* thinking bend over
 * time: a row of nodes connected by a line, oldest → newest.
 */
export default function ThreadLine({ revisions }: { revisions: RevisionEntry[] }) {
  if (revisions.length === 0) return null;

  const labelFor: Record<RevisionEntry["reason"], string> = {
    proposed: "Proposed",
    accepted: "Accepted",
    rewritten: "Rewritten",
    reaffirmed: "Reaffirmed",
    questioned: "Questioned",
  };

  return (
    <ol className="flex flex-col gap-0">
      {revisions.map((rev, i) => {
        const last = i === revisions.length - 1;
        return (
          <li key={`${rev.at}-${i}`} className="flex gap-3">
            {/* rail */}
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                  last
                    ? "bg-zinc-900 dark:bg-zinc-100"
                    : "bg-zinc-300 dark:bg-zinc-600"
                }`}
              />
              {!last && (
                <span className="w-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
              )}
            </div>
            {/* node */}
            <div className={`pb-4 ${last ? "" : ""}`}>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  {labelFor[rev.reason]}
                </span>
                <span className="text-xs text-zinc-400">
                  {new Date(rev.at).toLocaleDateString()}
                </span>
              </div>
              <p
                className={`mt-0.5 text-sm ${
                  last
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 line-through decoration-zinc-300 dark:decoration-zinc-600"
                }`}
              >
                {rev.text}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
