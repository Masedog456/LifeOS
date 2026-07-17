"use client";

import type { ResearchGap, ResearchGapKind } from "@/types/mvp";

const KIND_LABEL: Record<ResearchGapKind, string> = {
  unsupported_claim: "Unsupported claim",
  missing_evidence: "Missing evidence",
  contradictory_evidence: "Contradictory evidence",
  duplicate_evidence: "Duplicate evidence",
  orphan_question: "Orphan question",
  unresolved_hypothesis: "Unresolved hypothesis",
};

/** Deterministically-detected research gaps. Nothing is resolved for you. */
export default function GapList({ gaps }: { gaps: ResearchGap[] }) {
  if (gaps.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-black/[.10] p-6 text-sm text-zinc-500 dark:border-white/[.12]">
        No gaps detected right now. As you add questions, evidence, hypotheses, and arguments, unsupported
        claims, missing or contradictory evidence, duplicates, orphan questions, and unresolved hypotheses
        will surface here — never resolved for you, only shown.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {gaps.map((g) => (
        <li key={g.id} className="rounded-2xl border border-black/[.06] p-4 dark:border-white/[.08]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">{KIND_LABEL[g.kind]}</p>
          <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">{g.title}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{g.detail}</p>
        </li>
      ))}
    </ul>
  );
}
