"use client";

import Link from "next/link";
import type { TimelineItem, TimelineItemType } from "@/types/mvp";

const ICON: Record<TimelineItemType, string> = {
  capture: "✎",
  source_added: "📖",
  quote: "❝",
  proposal: "◆",
  judgment: "⚖",
  revision: "↻",
  comparison: "⇄",
  inquiry: "?",
  provisional_conclusion: "✓",
  belief_status: "●",
};

const TYPE_LABEL: Record<TimelineItemType, string> = {
  capture: "Capture",
  source_added: "Source",
  quote: "Quote",
  proposal: "Belief formed",
  judgment: "Judgment",
  revision: "Revision",
  comparison: "Comparison",
  inquiry: "Inquiry",
  provisional_conclusion: "Conclusion",
  belief_status: "Belief status",
};

export default function ThreadTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-400">No timeline yet — add members to this thread.</p>;
  }
  return (
    <ol className="relative flex flex-col border-l border-black/[.08] pl-5 dark:border-white/[.10]">
      {items.map((it) => {
        const body = (
          <>
            <span className="absolute -left-[9px] mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] text-zinc-500 ring-1 ring-black/[.08] dark:bg-zinc-900 dark:ring-white/[.12]">
              {ICON[it.type]}
            </span>
            <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-400">
              <span className="rounded bg-black/[.05] px-1.5 py-0.5 dark:bg-white/[.08]">{TYPE_LABEL[it.type]}</span>
              <span>{new Date(it.at).toLocaleDateString()}</span>
              {it.page != null && <span>· p. {it.page}</span>}
              {it.origin && <span>· {it.origin}</span>}
              {it.relation && <span>· {it.relation}</span>}
            </div>
            <p className="mt-0.5 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{it.title}</p>
            {it.detail && <p className="text-xs text-zinc-400">{it.detail}</p>}
          </>
        );
        return (
          <li key={it.id} className="relative mb-5">
            {it.href ? (
              <Link href={it.href} className="block hover:opacity-80">{body}</Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}
