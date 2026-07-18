"use client";

import { useMemo } from "react";
import type { DialogueSession } from "@/types/mvp";
import { addDialogueTurn, useStore } from "@/lib/mvpStore";
import { generateInquiries } from "@/lib/dialogue/socratic";

/**
 * The deterministic Socratic engine surface. Each line of inquiry is a PROMPT
 * — never an answer. "Ask" records it as a question turn (grounded in the
 * records it draws on); the user then writes their own response. Multiple lines
 * are offered; nothing is chosen for you.
 */
export default function SocraticPrompts({ session }: { session: DialogueSession }) {
  const state = useStore();
  const inquiries = useMemo(() => generateInquiries(state, session), [state, session]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-zinc-400">Lines of inquiry from your own knowledge. Ask one to add it as a question, then answer in your own words.</p>
      <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
        {inquiries.map((q) => (
          <li key={q.id} className="flex items-start justify-between gap-3 py-2.5">
            <span className="flex-1">
              <span className="block text-sm text-zinc-800 dark:text-zinc-200">{q.prompt}</span>
              <span className="mt-0.5 block text-xs text-zinc-400">{q.rationale}{q.relatedIds.length ? ` · draws on ${q.relatedIds.length} record${q.relatedIds.length === 1 ? "" : "s"}` : ""}</span>
            </span>
            <button
              type="button"
              onClick={() => addDialogueTurn(session.id, { kind: "question", text: q.prompt, author: "socratic", citations: q.relatedIds })}
              className="shrink-0 rounded-full border border-black/[.12] px-3 py-1 text-[11px] hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]"
            >
              Ask
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
