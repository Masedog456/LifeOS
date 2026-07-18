"use client";

import type { DialogueTimelineItem } from "@/types/mvp";

const KIND_DOT: Record<string, string> = {
  turn: "bg-zinc-400", insight: "bg-emerald-400", new_question: "bg-sky-400", dead_end: "bg-rose-400", session: "bg-indigo-400",
};

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** A derived, read-only chronological view of the dialogue. */
export default function DialogueTimeline({ items }: { items: DialogueTimelineItem[] }) {
  if (items.length === 0) {
    return <p className="rounded-2xl border border-dashed border-black/[.10] p-5 text-sm text-zinc-500 dark:border-white/[.12]">No history yet. As you add turns and mark insights, new questions, and dead ends, the dialogue&apos;s arc is recorded here — read-only.</p>;
  }
  return (
    <ol className="relative ml-2 border-l border-black/[.08] dark:border-white/[.10]">
      {items.map((item) => (
        <li key={item.id} className="relative mb-4 pl-6">
          <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${KIND_DOT[item.kind] ?? "bg-zinc-400"}`} />
          <span className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{item.kind.replace(/_/g, " ")}</span>
            <span className="text-[11px] text-zinc-400">{dateLabel(item.at)}</span>
          </span>
          <span className="mt-0.5 block text-sm text-zinc-800 dark:text-zinc-200">{item.title}</span>
          {item.detail && <span className="mt-0.5 block text-xs text-zinc-500">{item.detail}</span>}
        </li>
      ))}
    </ol>
  );
}
