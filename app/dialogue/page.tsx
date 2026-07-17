"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { createDialogue, useStore } from "@/lib/mvpStore";

const STATUS_ORDER: Record<string, number> = { open: 0, active: 1, paused: 2, concluded: 3, archived: 4 };

function snippet(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function DialogueWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const state = useStore();
  const [title, setTitle] = useState(params.get("title") ?? "");
  const [topic, setTopic] = useState(params.get("topic") ?? "");
  const [purpose, setPurpose] = useState("");

  const seed = useMemo<{ seedRefs: string[]; label?: string }>(() => {
    const belief = params.get("belief");
    if (belief) return { seedRefs: [belief], label: `belief “${snippet(state.beliefs.find((b) => b.id === belief)?.text ?? "", 40)}”` };
    const thread = params.get("thread");
    if (thread) return { seedRefs: [thread], label: `thread “${snippet(state.megathreads.find((t) => t.id === thread)?.title ?? "", 40)}”` };
    const research = params.get("research");
    if (research) return { seedRefs: [research], label: `research “${snippet(state.researchProjects.find((r) => r.id === research)?.title ?? "", 40)}”` };
    const concept = params.get("concept");
    if (concept) return { seedRefs: [concept], label: `concept “${snippet(state.concepts.find((c) => c.id === concept)?.name ?? "", 40)}”` };
    return { seedRefs: [] };
  }, [params, state]);

  function create() {
    if (!topic.trim()) return;
    const id = createDialogue({ title: title.trim() || topic.trim().slice(0, 60), topic, purpose, seedRefs: seed.seedRefs });
    router.push(`/dialogue/${id}`);
  }

  const dialogues = [...state.dialogueSessions].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || (a.updatedAt < b.updatedAt ? 1 : -1),
  );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dialogue</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Investigate an idea through structured, Socratic inquiry — grounded in your own knowledge. LifeOS
          asks the hard questions and surfaces your evidence; it does not answer for you. Not a chatbot, not
          roleplay, not autonomous reasoning.
        </p>
      </header>

      <section className="mb-8 rounded-2xl border border-black/[.06] p-5 dark:border-white/[.08]">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">New dialogue</h2>
        {seed.label && <p className="mt-1 text-xs text-zinc-400">Anchored to your {seed.label}.</p>}
        <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} placeholder="The idea or claim to investigate" className="mt-3 w-full resize-none rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]" />
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" className="mt-2 w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none dark:border-white/[.12]" />
        <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Purpose (optional)" className="mt-2 w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none dark:border-white/[.12]" />
        <button type="button" onClick={create} disabled={!topic.trim()} className="mt-3 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900">Open dialogue</button>
      </section>

      {dialogues.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Your dialogues</h2>
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {dialogues.map((d) => (
              <li key={d.id}>
                <Link href={`/dialogue/${d.id}`} className="flex items-start gap-3 py-3">
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{d.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
                      <span>{d.status}</span>
                      <span>· {d.turns.length} turn{d.turns.length === 1 ? "" : "s"}</span>
                      <span>· {d.participants.length} perspective{d.participants.length === 1 ? "" : "s"}</span>
                      {d.outcomes.length > 0 && <span>· {d.outcomes.length} outcome{d.outcomes.length === 1 ? "" : "s"}</span>}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

export default function DialoguePage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12" />}>
      <DialogueWorkspace />
    </Suspense>
  );
}
