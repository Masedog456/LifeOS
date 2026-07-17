"use client";

import Link from "next/link";
import type { TensionKind, WorldTension } from "@/types/mvp";

const KIND_LABEL: Record<TensionKind, string> = {
  isolated_concept: "Isolated concept",
  unsupported_concept: "Unsupported concept",
  duplicate_concept: "Possible duplicate",
  circular_definition: "Circular definition",
  contradictory_principle: "Contradictory principles",
  framework_overlap: "Framework overlap",
};

/**
 * Detected tensions — surfaced deterministically, never resolved automatically.
 * Each is an invitation to look, with an explicit reason.
 */
export default function TensionList({ tensions }: { tensions: WorldTension[] }) {
  if (tensions.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-black/[.10] p-6 text-sm text-zinc-500 dark:border-white/[.12]">
        No tensions detected right now. As your model grows, isolated concepts, duplicates, circular
        definitions, and framework overlaps will surface here — never resolved for you, only shown.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {tensions.map((t) => (
        <li key={t.id} className="rounded-2xl border border-black/[.06] p-4 dark:border-white/[.08]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">{KIND_LABEL[t.kind]}</p>
          {t.href ? (
            <Link href={t.href} className="mt-0.5 block text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100">{t.title}</Link>
          ) : (
            <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.title}</p>
          )}
          <p className="mt-0.5 text-xs text-zinc-500">{t.detail}</p>
        </li>
      ))}
    </ul>
  );
}
