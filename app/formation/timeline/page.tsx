"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/mvpStore";
import { buildFormationTimeline } from "@/lib/formation/timeline";
import FormationTimeline from "@/components/FormationTimeline";

export default function FormationTimelinePage() {
  const state = useStore();
  const items = useMemo(() => buildFormationTimeline(state), [state]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link href="/formation" className="text-sm text-zinc-400 underline-offset-4 hover:underline">← Reflect</Link>
      <header className="mb-6 mt-3">
        <h1 className="text-2xl font-semibold tracking-tight">Formation timeline</h1>
        <p className="mt-1 text-sm text-zinc-500">
          A chronological record of your reflections, belief revisions, decisions, inquiries, and practices —
          derived from your own history. You read it; it is never edited.
        </p>
      </header>
      <FormationTimeline items={items} />
    </main>
  );
}
