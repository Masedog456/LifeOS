"use client";

import Link from "next/link";
import type { WorldTimelineItem } from "@/types/mvp";

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** A derived, read-only chronological view of how the world model evolved. */
export default function WorldTimeline({ items }: { items: WorldTimelineItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-black/[.10] p-6 text-sm text-zinc-500 dark:border-white/[.12]">
        No history yet. As you define concepts, approve relationships, and build frameworks, their
        evolution is recorded here — read-only, never edited.
      </p>
    );
  }
  return (
    <ol className="relative ml-2 border-l border-black/[.08] dark:border-white/[.10]">
      {items.map((item) => {
        const body = (
          <>
            <span className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{item.kind.replace(/_/g, " ")}</span>
              <span className="text-[11px] text-zinc-400">{dateLabel(item.at)}</span>
            </span>
            <span className="mt-0.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</span>
            {item.detail && <span className="mt-0.5 block text-xs text-zinc-500">{item.detail}</span>}
          </>
        );
        return (
          <li key={item.id} className="relative mb-5 pl-6">
            <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-400" />
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
