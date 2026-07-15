"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { InquiryInputRef, InquiryStatus } from "@/types/mvp";
import {
  inquiryById,
  setInquiryConclusion,
  setInquiryStatus,
  updateInquiry,
  useStore,
} from "@/lib/mvpStore";
import { evolveInquiryFlow, MAX_SOURCES } from "@/lib/dialectic/run";
import DialecticResult from "@/components/DialecticResult";

const STATUSES: InquiryStatus[] = ["open", "provisional", "unresolved", "resolved"];

export default function InquiryDetailPage() {
  const params = useParams<{ id: string }>();
  const state = useStore();
  const inquiry = inquiryById(state, params.id);

  const [conclusion, setConclusion] = useState(inquiry?.provisionalConclusion ?? "");
  const [addIds, setAddIds] = useState<string[]>([]);
  const [evolving, setEvolving] = useState(false);
  const [showEvolve, setShowEvolve] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addableSources = useMemo(() => {
    if (!inquiry) return [];
    return state.sources.filter(
      (s) => (s.summary || s.keyConcepts.length || s.keyQuotes.length) && !inquiry.sourceIds.includes(s.id),
    );
  }, [state.sources, inquiry]);

  if (!inquiry) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-zinc-600 dark:text-zinc-300">Inquiry not found.</p>
        <Link href="/inquiry" className="text-sm text-zinc-500 underline-offset-4 hover:underline">← Back to Inquiry</Link>
      </main>
    );
  }

  const canAddMore = inquiry.sourceIds.length < MAX_SOURCES;

  async function evolve() {
    if (!inquiry || addIds.length === 0) return;
    setEvolving(true);
    setError(null);
    try {
      const added: InquiryInputRef[] = addIds
        .map((id) => state.sources.find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
        .map((s) => ({ kind: "source" as const, sourceId: s.id, label: s.title }));
      const next = await evolveInquiryFlow(state, inquiry, added);
      updateInquiry(next);
      setAddIds([]);
      setShowEvolve(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-run failed.");
    } finally {
      setEvolving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <div className="flex items-center justify-between gap-3">
        <Link href="/inquiry" className="text-sm text-zinc-500 underline-offset-4 hover:underline">← Inquiry</Link>
        <Link
          href={`/threads?seedType=inquiry&seedId=${inquiry.id}&title=${encodeURIComponent(inquiry.question.slice(0, 50))}`}
          className="text-sm text-zinc-500 underline-offset-4 hover:underline"
        >
          Create thread →
        </Link>
      </div>

      <div className="mt-4">
        <DialecticResult inquiry={inquiry} />
      </div>

      {/* Your provisional conclusion */}
      <section className="mt-10 rounded-2xl border border-black/[.06] p-5 dark:border-white/[.08]">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Your provisional conclusion</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Write where YOU land — in your own words. This is yours, not the AI&apos;s, and it never
          changes your Constitution automatically.
        </p>
        <textarea
          value={conclusion}
          onChange={(e) => setConclusion(e.target.value)}
          rows={3}
          placeholder="For now, I think…"
          className="mt-3 w-full resize-none rounded-lg border border-black/[.12] bg-transparent p-3 text-sm outline-none focus:border-black/[.25] dark:border-white/[.15] dark:focus:border-white/[.30]"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setInquiryConclusion(inquiry.id, conclusion, "provisional")}
            disabled={!conclusion.trim()}
            className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Save conclusion
          </button>
          <span className="text-xs text-zinc-400">Status:</span>
          {STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setInquiryStatus(inquiry.id, st)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                inquiry.status === st
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-black/[.10] text-zinc-500 hover:text-zinc-900 dark:border-white/[.12] dark:hover:text-zinc-100"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
        {inquiry.provisionalConclusion && (
          <p className="mt-3 rounded-lg bg-black/[.03] px-3 py-2 text-sm text-zinc-700 dark:bg-white/[.05] dark:text-zinc-300">
            {inquiry.provisionalConclusion}
          </p>
        )}
      </section>

      {/* Evolve: add sources & re-run (prior result preserved in history) */}
      <section className="mt-6">
        {canAddMore ? (
          <button
            type="button"
            onClick={() => setShowEvolve((v) => !v)}
            className="text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            {showEvolve ? "Cancel" : "Add sources & re-run"}
          </button>
        ) : (
          <p className="text-xs text-zinc-400">Maximum {MAX_SOURCES} sources reached.</p>
        )}
        {showEvolve && (
          <div className="mt-3">
            {addableSources.length === 0 ? (
              <p className="text-sm text-zinc-400">No further analyzed sources to add.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
                {addableSources.map((s) => {
                  const on = addIds.includes(s.id);
                  const disabled = !on && inquiry.sourceIds.length + addIds.length >= MAX_SOURCES;
                  return (
                    <li key={s.id}>
                      <label className={`flex cursor-pointer items-center gap-3 py-2 ${disabled ? "opacity-40" : ""}`}>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={disabled}
                          onChange={() =>
                            setAddIds((prev) => (prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]))
                          }
                        />
                        <span className="text-sm text-zinc-800 dark:text-zinc-200">{s.title}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            <button
              type="button"
              onClick={evolve}
              disabled={addIds.length === 0 || evolving}
              className="mt-3 rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {evolving ? "Re-running…" : "Re-run with added sources"}
            </button>
          </div>
        )}
      </section>

      {/* Append-only reasoning history */}
      {inquiry.history.length > 0 && (
        <section className="mt-8 border-t border-black/[.05] pt-6 dark:border-white/[.06]">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            {showHistory ? "Hide" : "Show"} reasoning history ({inquiry.history.length})
          </button>
          {showHistory && (
            <div className="mt-3 flex flex-col gap-5">
              {[...inquiry.history].reverse().map((h, i) => (
                <div key={i} className="rounded-xl border border-black/[.06] p-4 text-sm dark:border-white/[.08]">
                  <p className="text-xs text-zinc-400">
                    {new Date(h.at).toLocaleString()} · {h.source === "ai" ? "AI" : "mock"}
                    {h.addedInputs && h.addedInputs.length > 0 && ` · then added: ${h.addedInputs.join(", ")}`}
                  </p>
                  {h.result.affirmativeCase.slice(0, 2).map((p, j) => (
                    <p key={`a${j}`} className="mt-2 text-zinc-700 dark:text-zinc-300">
                      <span className="text-emerald-600 dark:text-emerald-400">＋</span> {p.statement}
                    </p>
                  ))}
                  {h.result.negativeCase.slice(0, 2).map((p, j) => (
                    <p key={`n${j}`} className="mt-1 text-zinc-700 dark:text-zinc-300">
                      <span className="text-zinc-400">−</span> {p.statement}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
