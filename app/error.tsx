"use client";

/**
 * Recoverable error boundary (LIFEOS-025). Catches any render/runtime error in
 * a route segment so the user never sees a raw exception. Local data is written
 * synchronously on every change, so nothing is lost — "Try again" re-renders,
 * and Daily Home is always a safe place to land.
 */

import Link from "next/link";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start justify-center gap-3 px-6 py-16">
      <h1 className="text-xl font-semibold tracking-tight">Something went wrong on this page</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Your data is safe — every change is saved locally the moment you make it. You can retry this page or head
        back to Daily Home.
      </p>
      {error.digest && <p className="text-[11px] text-zinc-400">Reference: {error.digest}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => reset()} className="rounded-full border border-black/[.12] px-4 py-2 text-sm hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]">
          Try again
        </button>
        <Link href="/today" className="rounded-full px-4 py-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← Daily Home
        </Link>
      </div>
    </main>
  );
}
