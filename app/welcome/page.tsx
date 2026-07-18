"use client";

/**
 * First-run onboarding (LIFEOS-025).
 *
 * A lightweight, four-step tour: what LifeOS is, the cognitive loop, a real
 * first capture (the user's own words — no fake data is created without their
 * awareness), the first belief judgment, and where to start each day. Skippable
 * at every step and restartable from this page; progress and completion persist
 * per user (localStorage + the own-rows `user_prefs` table when signed in).
 */

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addCapture, attachProposals, pendingProposals, useStore } from "@/lib/mvpStore";
import { generateBeliefs } from "@/lib/aiClient";
import { completeOnboarding, isOnboardingDone, readPrefs, restartOnboarding, writePrefs } from "@/lib/prefs";

const LOOP = [
  ["Capture", "a passing thought, a quote, a page — everything starts as a capture"],
  ["Belief", "captures become belief proposals; only YOU accept them into your Constitution"],
  ["Understand", "beliefs connect into concepts, principles, and frameworks — your world model"],
  ["Investigate", "research projects and Socratic dialogues test what you think against evidence"],
  ["Integrate", "tensions between ideas become explicit, and syntheses resolve them honestly"],
  ["Act & reflect", "decisions, reviews, and formation practices close the loop back into life"],
] as const;

export default function WelcomePage() {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const state = useStore();
  const router = useRouter();
  const [step, setStep] = useState(() => readPrefs().onboardingStep ?? 0);
  const [thought, setThought] = useState("");
  const [captured, setCaptured] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!mounted) return <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10" />;

  const done = isOnboardingDone();
  const pending = pendingProposals(state).length;

  function go(n: number) {
    setStep(n);
    writePrefs({ onboardingStep: n });
  }
  function skip() {
    completeOnboarding("skipped");
    router.push("/today");
  }
  function finish() {
    completeOnboarding("done");
    router.push("/orchestrator");
  }
  async function captureFirst() {
    const raw = thought.trim();
    if (!raw || busy) return;
    setBusy(true);
    const captureId = addCapture(raw); // saved locally first, like the Capture page
    const { result, source } = await generateBeliefs(raw);
    attachProposals(captureId, result, source);
    setBusy(false);
    setCaptured(true);
  }

  if (done) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome tour</h1>
        <p className="mt-2 text-sm text-zinc-500">You&apos;ve already completed (or skipped) the tour.</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => { restartOnboarding(); setStep(0); setCaptured(false); }} className="rounded-full border border-black/[.12] px-4 py-2 text-sm hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]">Restart the tour</button>
          <Link href="/today" className="rounded-full px-4 py-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">← Daily Home</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to LifeOS</h1>
        <button type="button" onClick={skip} className="text-xs text-zinc-400 underline-offset-4 hover:underline">Skip the tour</button>
      </header>

      <div className="mb-6 flex gap-1.5" aria-label={`Step ${step + 1} of 4`}>
        {[0, 1, 2, 3].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-zinc-800 dark:bg-zinc-200" : "bg-black/[.08] dark:bg-white/[.10]"}`} />)}
      </div>

      {step === 0 && (
        <section>
          <h2 className="text-lg font-medium">An operating system for what you believe</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            LifeOS turns books, notes, and passing thoughts into examined beliefs, an explicit world model, and
            practices that shape your days. Nothing is ever changed for you: AI proposes, deterministic engines
            surface structure, and <span className="font-medium">you judge everything</span>.
          </p>
          <ol className="mt-4 flex flex-col gap-2">
            {LOOP.map(([name, desc], i) => (
              <li key={name} className="flex gap-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/[.06] text-[10px] font-semibold dark:bg-white/[.10]">{i + 1}</span>
                <span><span className="font-medium">{name}</span> — <span className="text-zinc-500">{desc}</span></span>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => go(1)} className="mt-5 rounded-full border border-black/[.12] px-4 py-2 text-sm hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]">Next: capture a thought →</button>
        </section>
      )}

      {step === 1 && (
        <section>
          <h2 className="text-lg font-medium">Capture your first thought</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Type something you actually think — a belief, a question, a hunch. This creates a <span className="font-medium">real capture</span> in
            your LifeOS (your words, your data — nothing synthetic is planted).
          </p>
          <textarea value={thought} onChange={(e) => setThought(e.target.value)} rows={3} placeholder="e.g. Deep focus matters more than long hours." className="mt-3 w-full rounded-xl border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none dark:border-white/[.12]" />
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={() => void captureFirst()} disabled={!thought.trim() || busy || captured} className="rounded-full border border-black/[.12] px-4 py-2 text-sm disabled:opacity-30 dark:border-white/[.15]">{busy ? "Capturing…" : captured ? "Captured ✓" : "Capture it"}</button>
            {captured && <span className="text-xs text-emerald-600 dark:text-emerald-400">Saved — and a belief proposal is waiting for your judgment.</span>}
            <button type="button" onClick={() => go(2)} className="ml-auto rounded-full px-3 py-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">{captured ? "Next →" : "Skip this step →"}</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <h2 className="text-lg font-medium">Your first belief is yours to judge</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Captures become <span className="font-medium">belief proposals</span> in your Inbox. Nothing enters your Constitution until you
            accept it — you can also rewrite it in your own words, question it, or reject it. That judgment loop is
            the heart of LifeOS.
          </p>
          <p className="mt-3 text-sm text-zinc-500">{pending > 0 ? `${pending} proposal${pending === 1 ? "" : "s"} waiting right now.` : "Your Inbox is empty — capture something first, or just continue."}</p>
          <div className="mt-3 flex items-center gap-2">
            {pending > 0 && <Link href="/inbox" className="rounded-full border border-black/[.12] px-4 py-2 text-sm hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]">Open the Belief Inbox</Link>}
            <button type="button" onClick={() => go(3)} className="ml-auto rounded-full px-3 py-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">Next →</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h2 className="text-lg font-medium">Start each day in one place</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Two pages anchor daily use: <Link href="/today" className="underline underline-offset-4">Today</Link> shows what deserves attention,
            and the <span className="font-medium">LifeOS Inbox</span> collects deterministic recommendations from every subsystem —
            contradictions to investigate, beliefs to review, tensions to resolve. Nothing is ever done automatically.
          </p>
          <p className="mt-3 text-sm text-zinc-500"><span className="font-medium">Suggested next step:</span> open the LifeOS Inbox and press “Scan now” — it will tell you what your knowledge already wants you to look at.</p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={finish} className="rounded-full border border-black/[.12] px-4 py-2 text-sm hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]">Finish → open the LifeOS Inbox</button>
            <Link href="/today" onClick={() => completeOnboarding("done")} className="rounded-full px-4 py-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">or go to Today</Link>
          </div>
        </section>
      )}
    </main>
  );
}
