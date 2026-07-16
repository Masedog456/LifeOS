"use client";

import Link from "next/link";
import type { FormationTimelineItem, FormationTimelineKind } from "@/types/mvp";

const KIND_LABEL: Record<FormationTimelineKind, string> = {
  reflection: "Reflection",
  belief_revision: "Belief",
  decision: "Decision",
  outcome_review: "Outcome",
  inquiry: "Inquiry",
  practice_change: "Practice",
  thread_created: "Thread",
};

const KIND_DOT: Record<FormationTimelineKind, string> = {
  reflection: "bg-sky-400",
  belief_revision: "bg-emerald-400",
  decision: "bg-violet-400",
  outcome_review: "bg-amber-400",
  inquiry: "bg-rose-400",
  practice_change: "bg-teal-400",
  thread_created: "bg-indigo-400",
};

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** A derived, read-only chronological view. Nothing here is editable. */
export default function FormationTimeline({ items }: { items: FormationTimelineItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-black/[.10] p-6 text-sm text-zinc-500 dark:border-white/[.12]">
        Your formation timeline is empty. As you reflect, revise beliefs, decide, and inquire, this fills
        in on its own — a record you read, never edit.
      </p>
    );
  }

  return (
    <ol className="relative ml-2 border-l border-black/[.08] dark:border-white/[.10]">
      {items.map((item) => {
        const body = (
          <>
            <span className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{KIND_LABEL[item.kind]}</span>
              <span className="text-[11px] text-zinc-400">{dateLabel(item.at)}</span>
            </span>
            <span className="mt-0.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</span>
            {item.detail && <span className="mt-0.5 block text-xs text-zinc-500">{item.detail}</span>}
          </>
        );
        return (
          <li key={item.id} className="relative mb-5 pl-6">
            <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${KIND_DOT[item.kind]}`} />
            {item.href ? (
              <Link href={item.href} className="block rounded-lg px-1 py-0.5 hover:bg-black/[.03] dark:hover:bg-white/[.05]">{body}</Link>
            ) : (
              <span className="block px-1 py-0.5">{body}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
