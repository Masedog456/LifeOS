"use client";

import type { ConfidenceLevel, DialecticConfidence } from "@/types/mvp";
import { CONFIDENCE_LABEL } from "@/lib/dialectic/confidence";

const AXES: { key: keyof DialecticConfidence; label: string; hint: string }[] = [
  { key: "factual", label: "Factual", hint: "How well-established the underlying facts are" },
  { key: "logical", label: "Logical", hint: "Soundness of the reasoning connecting the claims" },
  { key: "evidential", label: "Evidential", hint: "Strength and independence of the cited evidence" },
  { key: "experiential", label: "Experiential", hint: "Support from your own lived experience" },
];

const DOTS: Record<ConfidenceLevel, number> = { unknown: 0, low: 1, moderate: 2, high: 3 };
const TONE: Record<ConfidenceLevel, string> = {
  unknown: "bg-zinc-300 dark:bg-zinc-600",
  low: "bg-amber-400",
  moderate: "bg-sky-400",
  high: "bg-emerald-400",
};

/**
 * Renders the FOUR confidence axes separately — never a single collapsed score.
 * `unknown` reads as empty dots, honestly signalling "we don't know" rather than
 * a low-but-nonzero number.
 */
export default function ConfidenceMeter({ confidence, compact = false }: { confidence: DialecticConfidence; compact?: boolean }) {
  return (
    <div className={compact ? "flex flex-wrap gap-x-4 gap-y-1" : "grid grid-cols-2 gap-x-4 gap-y-2"}>
      {AXES.map(({ key, label, hint }) => {
        const level = confidence[key] ?? "unknown";
        return (
          <div key={key} className="flex items-center gap-2" title={hint}>
            <span className="w-[74px] shrink-0 text-[11px] text-zinc-500">{label}</span>
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < DOTS[level] ? TONE[level] : "bg-black/[.08] dark:bg-white/[.10]"}`} />
              ))}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-zinc-400">{CONFIDENCE_LABEL[level]}</span>
          </div>
        );
      })}
    </div>
  );
}
