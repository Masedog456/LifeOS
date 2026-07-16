"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import type { FormationSessionType } from "@/types/mvp";
import { createFormationSession, useStore } from "@/lib/mvpStore";
import { generatePrompts, SESSION_TYPE_LABEL } from "@/lib/formation/prompts";
import { buildCadenceReview, CADENCE_LABEL, type CadencePeriod } from "@/lib/formation/cadence";
import { decisionCaution } from "@/lib/decision/safety";

const TYPES: FormationSessionType[] = [
  "evening", "morning", "decision_review", "book_integration", "conversation_review",
  "failure_analysis", "success_analysis", "conflict_reflection", "practice_reflection", "open", "custom",
];
const PERIODS: CadencePeriod[] = ["today", "week", "month", "year", "life"];
const STATUS_ORDER: Record<string, number> = { draft: 0, reflecting: 1, synthesized: 2, closed: 3 };

function snippet(s: string, n = 56): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function FormationHome() {
  const router = useRouter();
  const params = useSearchParams();
  const state = useStore();

  // Entry-point seeds — records force-included in the evidence packet + linked.
  const links = useMemo(() => ({
    beliefs: [params.get("belief")].filter((x): x is string => Boolean(x)),
    decisions: [params.get("decision")].filter((x): x is string => Boolean(x)),
    threads: [params.get("thread")].filter((x): x is string => Boolean(x)),
    inquiries: [params.get("inquiry")].filter((x): x is string => Boolean(x)),
    sources: [params.get("source")].filter((x): x is string => Boolean(x)),
    reflections: [params.get("reflection")].filter((x): x is string => Boolean(x)),
  }), [params]);
  const seedLabel = useMemo(() => {
    const b = params.get("belief");
    if (b) return `belief: “${snippet(state.beliefs.find((x) => x.id === b)?.text ?? "", 46)}”`;
    const d = params.get("decision");
    if (d) return `decision: “${snippet(state.decisions.find((x) => x.id === d)?.title ?? "", 46)}”`;
    const t = params.get("thread");
    if (t) return `thread: “${snippet(state.megathreads.find((x) => x.id === t)?.title ?? "", 46)}”`;
    const iq = params.get("inquiry");
    if (iq) return `inquiry: “${snippet(state.inquiries.find((x) => x.id === iq)?.question ?? "", 46)}”`;
    const src = params.get("source");
    if (src) return `source: “${snippet(state.sources.find((x) => x.id === src)?.title ?? "", 46)}”`;
    return undefined;
  }, [params, state]);

  const defaultType = (params.get("type") as FormationSessionType) ?? (params.get("decision") ? "decision_review" : params.get("source") ? "book_integration" : "evening");
  const [type, setType] = useState<FormationSessionType>(TYPES.includes(defaultType) ? defaultType : "evening");
  const [customType, setCustomType] = useState("");
  const [title, setTitle] = useState(params.get("title") ?? "");
  const [period, setPeriod] = useState<CadencePeriod>("today");

  const cadence = useMemo(() => buildCadenceReview(state, period), [state, period]);
  const caution = decisionCaution(`${title} ${customType}`);

  function begin() {
    const prompts = generatePrompts(state, type, links);
    const autoTitle = title.trim()
      || (type === "custom" && customType.trim() ? customType.trim() : SESSION_TYPE_LABEL[type])
        + " · " + new Date().toLocaleDateString();
    const sid = createFormationSession({
      title: autoTitle,
      type,
      customType: type === "custom" ? customType : undefined,
      prompt: prompts[0] ?? "What are you reflecting on?",
      suggestedPrompts: prompts,
      seedRefs: [...links.beliefs, ...links.decisions, ...links.threads, ...links.inquiries, ...links.sources, ...links.reflections],
      linkedBeliefs: links.beliefs,
      linkedDecisions: links.decisions,
      linkedThreads: links.threads,
      linkedInquiries: links.inquiries,
      linkedSources: links.sources,
      linkedReflections: links.reflections,
      sensitive: caution,
    });
    router.push(`/formation/${sid}`);
  }

  const sessions = [...state.formationSessions].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || (a.updatedAt < b.updatedAt ? 1 : -1),
  );

  const bySection = useMemo(() => {
    const m = new Map<string, typeof cadence.items>();
    for (const item of cadence.items) {
      const arr = m.get(item.section) ?? [];
      arr.push(item);
      m.set(item.section, arr);
    }
    return [...m.entries()];
  }, [cadence]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reflect</h1>
        <p className="mt-1 text-sm text-zinc-500">
          A place to examine yourself, integrate experience, and grow deliberately — the bridge between
          what you know and how you live. LifeOS asks; you reflect and decide.
        </p>
      </header>

      {/* New reflection */}
      <section className="mb-8 rounded-2xl border border-black/[.06] p-5 dark:border-white/[.08]">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">New reflection</h2>
        {seedLabel && <p className="mt-1 text-xs text-zinc-400">Will include your {seedLabel} as evidence.</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                type === t
                  ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-black/[.12] text-zinc-500 hover:text-zinc-900 dark:border-white/[.15] dark:hover:text-zinc-100"
              }`}
            >
              {SESSION_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        {type === "custom" && (
          <input
            value={customType}
            onChange={(e) => setCustomType(e.target.value)}
            placeholder="Name your reflection type (e.g. Sabbath review)"
            className="mt-3 w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]"
          />
        )}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Optional title"
          className="mt-2 w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]"
        />
        {caution && (
          <p className="mt-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {caution}
          </p>
        )}
        <button
          type="button"
          onClick={begin}
          disabled={type === "custom" && !customType.trim()}
          className="mt-3 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Begin reflection
        </button>
      </section>

      {/* Cadence review (invitational) */}
      <section className="mb-8">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">What&apos;s inviting your attention</h2>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                period === p
                  ? "bg-black/[.06] font-medium dark:bg-white/[.10]"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {CADENCE_LABEL[p]}
            </button>
          ))}
        </div>
        {bySection.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-black/[.10] p-5 text-sm text-zinc-500 dark:border-white/[.12]">
            Nothing is asking for your attention in this window. That&apos;s a fine place to be — reflect if you
            wish, or come back later.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {bySection.map(([section, items]) => (
              <div key={section}>
                <h3 className="mb-1 text-xs font-medium text-zinc-500">{section}</h3>
                <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
                  {items.map((item) => (
                    <li key={item.id} className="py-2.5">
                      {item.href ? (
                        <Link href={item.href} className="block text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100">{item.title}</Link>
                      ) : (
                        <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</span>
                      )}
                      <span className="mt-0.5 block text-xs text-zinc-400">{item.invitation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Your reflections</h2>
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {sessions.slice(0, 12).map((s) => (
              <li key={s.id}>
                <Link href={`/formation/${s.id}`} className="flex items-start gap-3 py-3">
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{s.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
                      <span>{SESSION_TYPE_LABEL[s.type]}</span>
                      <span>· {s.status}</span>
                      {s.synthesis && <span>· synthesized</span>}
                      <span>· {new Date(s.updatedAt).toLocaleDateString()}</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="border-t border-black/[.05] pt-6 dark:border-white/[.06]">
        <Link href="/formation/timeline" className="text-sm text-zinc-500 underline-offset-4 hover:underline">Your formation timeline →</Link>
      </div>
    </main>
  );
}

export default function FormationPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12" />}>
      <FormationHome />
    </Suspense>
  );
}
