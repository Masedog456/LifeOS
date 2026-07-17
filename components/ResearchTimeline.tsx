"use client";

import type { ResearchTimelineItem } from "@/types/mvp";

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** A derived, read-only chronological view of the investigation. */
export default function ResearchTimeline({ items }: { items: ResearchTimelineItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-black/[.10] p-6 text-sm text-zinc-500 dark:border-white/[.12]">
        No history yet. As you refine questions, add evidence, and revise hypotheses, the investigation&apos;s
        evolution is recorded here — read-only, never edited.
      </p>
    );
  }
  return (
    <ol className="relative ml-2 border-l border-black/[.08] dark:border-white/[.10]">
      {items.map((item) => (
        <li key={item.id} className="relative mb-5 pl-6">
          <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-sky-400" />
          <span className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{item.kind}</span>
            <span className="text-[11px] text-zinc-400">{dateLabel(item.at)}</span>
          </span>
          <span className="mt-0.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</span>
          {item.detail && <span className="mt-0.5 block text-xs text-zinc-500">{item.detail}</span>}
        </li>
      ))}
    </ol>
  );
}
