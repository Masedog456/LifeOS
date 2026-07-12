"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { comparisonById, useStore } from "@/lib/mvpStore";
import ComparisonResult from "@/components/ComparisonResult";

export default function ComparisonDetailPage() {
  const params = useParams<{ id: string }>();
  const state = useStore();
  const comparison = comparisonById(state, params.id);

  if (!comparison) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-zinc-600 dark:text-zinc-300">Comparison not found.</p>
        <Link href="/compare" className="text-sm text-zinc-500 underline-offset-4 hover:underline">
          ← Back to Compare
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <div className="flex items-center justify-between gap-3">
        <Link href="/compare" className="text-sm text-zinc-500 underline-offset-4 hover:underline">
          ← Compare
        </Link>
        <Link
          href={`/inquiry?comparison=${comparison.id}&q=${encodeURIComponent(comparison.question)}`}
          className="text-sm text-zinc-500 underline-offset-4 hover:underline"
        >
          Investigate this question →
        </Link>
      </div>
      <div className="mt-4">
        <ComparisonResult comparison={comparison} />
      </div>
    </main>
  );
}
