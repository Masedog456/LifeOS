"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { comparisonById, getStoreSnapshot, updateComparison, useStore } from "@/lib/mvpStore";
import { rerunComparison } from "@/lib/comparison/run";
import { comparisonDeps } from "@/lib/freshness/fingerprint";
import ComparisonResult from "@/components/ComparisonResult";
import FreshnessBadge from "@/components/FreshnessBadge";

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
        <div className="flex items-center gap-4">
          <Link
            href={`/inquiry?comparison=${comparison.id}&q=${encodeURIComponent(comparison.question)}`}
            className="text-sm text-zinc-500 underline-offset-4 hover:underline"
          >
            Investigate this question →
          </Link>
          <Link
            href={`/threads?seedType=comparison&seedId=${comparison.id}&title=${encodeURIComponent(comparison.title)}`}
            className="text-sm text-zinc-500 underline-offset-4 hover:underline"
          >
            Create thread →
          </Link>
        </div>
      </div>
      <div className="mt-4">
        <FreshnessBadge
          state={state}
          fingerprint={comparison.fingerprint}
          currentIds={comparisonDeps(comparison)}
          approxAiCalls={comparison.sourceIds.length >= 4 ? 2 : 1}
          onRerun={async () => {
            const next = await rerunComparison(getStoreSnapshot(), comparison);
            updateComparison(next);
          }}
        />
      </div>
      <div className="mt-4">
        <ComparisonResult comparison={comparison} />
      </div>
      {comparison.history && comparison.history.length > 0 && (
        <p className="mt-6 text-xs text-zinc-400">
          {comparison.history.length} prior result{comparison.history.length === 1 ? "" : "s"} preserved in history.
        </p>
      )}
    </main>
  );
}
