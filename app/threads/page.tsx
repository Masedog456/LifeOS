"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import type { MegathreadSeedType, ThreadMemberType } from "@/types/mvp";
import { addThreadMember, createMegathread, useStore } from "@/lib/mvpStore";
import { initialMembers } from "@/lib/megathread/membership";

function snippet(s: string, n = 60): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

const STATUS_ORDER = { active: 0, dormant: 1, archived: 2 } as const;

function ThreadsWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const state = useStore();

  // Seed from entry-point links.
  const seedType = (params.get("seedType") as MegathreadSeedType | null) ?? "manual";
  const seedId = params.get("seedId") ?? undefined;
  const seedTitleParam = params.get("title") ?? "";

  const seedLabel = useMemo(() => {
    if (!seedId) return undefined;
    if (seedType === "belief") return snippet(state.beliefs.find((b) => b.id === seedId)?.text ?? "", 50);
    if (seedType === "source") return state.sources.find((s) => s.id === seedId)?.title;
    if (seedType === "comparison") return snippet(state.comparisons.find((c) => c.id === seedId)?.title ?? "", 50);
    if (seedType === "inquiry") return snippet(state.inquiries.find((i) => i.id === seedId)?.question ?? "", 50);
    return undefined;
  }, [seedType, seedId, state]);

  const [title, setTitle] = useState(seedTitleParam || seedLabel || "");
  const [description, setDescription] = useState("");

  // The member type/id the seed maps to (for "add to existing thread").
  const seedMemberType: ThreadMemberType | null =
    seedType === "belief" ? "belief"
    : seedType === "source" ? "source"
    : seedType === "comparison" ? "comparison"
    : seedType === "inquiry" ? "inquiry"
    : null;

  function create() {
    const t = title.trim();
    if (!t) return;
    const members = seedId ? initialMembers(state, seedType, seedId) : [];
    const threadId = createMegathread({ title: t, description, seedType, seedId, seedLabel, members });
    router.push(`/threads/${threadId}`);
  }

  const threads = [...state.megathreads].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.updatedAt < b.updatedAt ? 1 : -1),
  );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Megathreads</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Living, provenance-grounded timelines of how your understanding of a topic develops over time.
        </p>
      </header>

      {/* New thread */}
      <section className="mb-8 rounded-2xl border border-black/[.06] p-5 dark:border-white/[.08]">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">New Megathread</h2>
        {seedLabel && (
          <p className="mt-1 text-xs text-zinc-400">Seeded from {seedType}: “{seedLabel}”</p>
        )}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Thread title (e.g. Attention & devotion)"
          className="mt-3 w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="mt-2 w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]"
        />
        <button
          type="button"
          onClick={create}
          disabled={!title.trim()}
          className="mt-3 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Create thread
        </button>

        {/* Add seed to an existing thread instead */}
        {seedId && seedMemberType && threads.length > 0 && (
          <div className="mt-4 border-t border-black/[.05] pt-3 dark:border-white/[.06]">
            <p className="text-xs text-zinc-400">Or add it to an existing thread:</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {threads.filter((t) => t.status !== "archived").map((t) => {
                const already = t.members.some((m) => m.type === seedMemberType && m.id === seedId);
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{t.title}</span>
                    <button
                      type="button"
                      disabled={already}
                      onClick={() => {
                        addThreadMember(t.id, { type: seedMemberType, id: seedId, addedBy: "user", reason: "added from entry point" });
                        router.push(`/threads/${t.id}`);
                      }}
                      className="rounded-full border border-black/[.12] px-3 py-1 text-xs hover:bg-black/[.04] disabled:opacity-40 dark:border-white/[.15] dark:hover:bg-white/[.06]"
                    >
                      {already ? "Already in" : "Add"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Saved threads */}
      {threads.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Your threads</h2>
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {threads.map((t) => (
              <li key={t.id}>
                <Link href={`/threads/${t.id}`} className="flex items-start gap-3 py-3">
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
                      <span>{t.status}</span>
                      <span>· {t.members.length} member{t.members.length === 1 ? "" : "s"}</span>
                      {t.synthesis && <span>· synthesized</span>}
                      <span>· updated {new Date(t.updatedAt).toLocaleDateString()}</span>
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

export default function ThreadsPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12" />}>
      <ThreadsWorkspace />
    </Suspense>
  );
}
