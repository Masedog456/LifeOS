"use client";

import { useMemo, useState } from "react";
import type {
  Comparison,
  ComparisonDecision,
  ComparisonPoint,
  EvidenceItem,
} from "@/types/mvp";
import { judgeComparisonInsight, sendToInbox } from "@/lib/mvpStore";

const CONTRADICTION_LABEL: Record<string, string> = {
  logical: "logical contradiction",
  practical: "practical tension",
  definitional: "different definitions",
  level_of_analysis: "different level of analysis",
  historical: "historical development",
  ambiguity: "unresolved ambiguity",
};

function truncate(s: string, n = 160): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function EvidenceChips({ ids, byId }: { ids: string[]; byId: Map<string, EvidenceItem> }) {
  if (!ids.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const e = byId.get(id);
        if (!e) return null;
        const prov = [e.group, e.page != null ? `p. ${e.page}` : ""].filter(Boolean).join(" · ");
        return (
          <span
            key={id}
            title={e.text}
            className="inline-flex max-w-full items-center gap-1 rounded bg-black/[.05] px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-white/[.08] dark:text-zinc-400"
          >
            <span className="font-mono text-[10px] text-zinc-400">{id}</span>
            <span className="truncate">{prov}: “{truncate(e.text, 60)}”</span>
          </span>
        );
      })}
    </div>
  );
}

/** An insight the user can judge (accept → Inbox / rewrite / question / reject). */
function Judgeable({
  comparison,
  insightRef,
  statement,
  ids,
  byId,
}: {
  comparison: Comparison;
  insightRef: string;
  statement: string;
  ids: string[];
  byId: Map<string, EvidenceItem>;
}) {
  const existing = comparison.judgments.find((j) => j.insightRef === insightRef);
  const [decision, setDecision] = useState<ComparisonDecision | null>(existing?.decision ?? null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(statement);

  function accept(text: string, d: ComparisonDecision) {
    // Insights become CANDIDATES in the existing Belief Inbox — never a
    // Constitution change. Reuse the same inbox pipeline as everywhere else.
    if (d === "accepted" || d === "rewritten") {
      sendToInbox(text, [{ claim: text }], comparison.source);
    }
    judgeComparisonInsight(comparison.id, insightRef, d);
    setDecision(d);
    setEditing(false);
  }

  return (
    <li className="py-3">
      <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{statement}</p>
      <EvidenceChips ids={ids} byId={byId} />

      {editing ? (
        <div className="mt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            autoFocus
            className="w-full resize-none rounded-lg border border-black/[.12] bg-transparent p-2.5 text-sm outline-none focus:border-black/[.25] dark:border-white/[.15] dark:focus:border-white/[.30]"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => accept(draft.trim() || statement, "rewritten")}
              className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Send rewrite to Inbox
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full px-3 py-1 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : decision ? (
        <p className="mt-1.5 text-xs text-zinc-400">
          {decision === "accepted" && "→ Sent to your Belief Inbox."}
          {decision === "rewritten" && "→ Rewritten and sent to your Belief Inbox."}
          {decision === "questioned" && "Marked as questioned."}
          {decision === "rejected" && "Rejected."}
          <button
            type="button"
            onClick={() => setDecision(null)}
            className="ml-2 underline-offset-4 hover:underline"
          >
            change
          </button>
        </p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => accept(statement, "accepted")}
            className="rounded-full border border-black/[.12] px-2.5 py-1 hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]"
          >
            Accept → Inbox
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-black/[.12] px-2.5 py-1 hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]"
          >
            Rewrite
          </button>
          <button
            type="button"
            onClick={() => accept(statement, "questioned")}
            className="rounded-full px-2.5 py-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            Question
          </button>
          <button
            type="button"
            onClick={() => accept(statement, "rejected")}
            className="rounded-full px-2.5 py-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            Reject
          </button>
        </div>
      )}
    </li>
  );
}

function InfoPoints({ points, byId }: { points: ComparisonPoint[]; byId: Map<string, EvidenceItem> }) {
  return (
    <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
      {points.map((p, i) => (
        <li key={i} className="py-3">
          <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{p.statement}</p>
          <EvidenceChips ids={p.evidenceIds} byId={byId} />
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
      {children}
    </section>
  );
}

export default function ComparisonResult({ comparison }: { comparison: Comparison }) {
  const r = comparison.result;
  const byId = useMemo(() => new Map(comparison.evidence.map((e) => [e.id, e])), [comparison.evidence]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span className="rounded bg-black/[.05] px-1.5 py-0.5 dark:bg-white/[.08]">
            {comparison.source === "ai" ? "AI" : "mock"}
          </span>
          {comparison.verified && <span>· verified</span>}
          <span>· {new Date(comparison.createdAt).toLocaleDateString()}</span>
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{r.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{r.question}</p>
        <p className="mt-1 text-xs text-zinc-400">Comparing: {r.sourcesCompared.join(" · ")}</p>
      </header>

      {comparison.partial && (
        <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          ⚠︎ {r.coverageNote}
        </p>
      )}

      <p className="text-xs text-zinc-400">
        These are proposals, not conclusions — accept an insight to review it in your Belief Inbox.
        Nothing here changes your Constitution automatically.
      </p>

      {r.sharedConcepts.length > 0 && (
        <Section title="Shared concepts">
          <div className="flex flex-wrap gap-1.5">
            {r.sharedConcepts.map((c) => (
              <span
                key={c}
                className="rounded-full border border-black/[.10] px-2.5 py-0.5 text-xs text-zinc-600 dark:border-white/[.12] dark:text-zinc-300"
              >
                {c}
              </span>
            ))}
          </div>
        </Section>
      )}

      {r.agreements.length > 0 && (
        <Section title="Where they agree">
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {r.agreements.map((p, i) => (
              <Judgeable
                key={i}
                comparison={comparison}
                insightRef={`agreement:${i}`}
                statement={p.statement}
                ids={p.evidenceIds}
                byId={byId}
              />
            ))}
          </ul>
        </Section>
      )}

      {r.disagreements.length > 0 && (
        <Section title="Where they disagree">
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {r.disagreements.map((p, i) => (
              <li key={i}>
                <span className="mt-3 inline-block rounded bg-black/[.05] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-white/[.08]">
                  {CONTRADICTION_LABEL[p.kind] ?? p.kind}
                </span>
                <Judgeable
                  comparison={comparison}
                  insightRef={`disagreement:${i}`}
                  statement={p.statement}
                  ids={p.evidenceIds}
                  byId={byId}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.terminologyDifferences.length > 0 && (
        <Section title="Terminology — same word, different meaning?">
          <ul className="flex flex-col gap-3">
            {r.terminologyDifferences.map((t, i) => (
              <li key={i}>
                <p className="text-sm text-zinc-800 dark:text-zinc-200">
                  <span className="font-medium">{t.term}</span> — {t.note}
                </p>
                <EvidenceChips ids={t.evidenceIds} byId={byId} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.assumptions.length > 0 && (
        <Section title="Underlying assumptions">
          <InfoPoints points={r.assumptions} byId={byId} />
        </Section>
      )}

      {r.strongestEvidence.length > 0 && (
        <Section title="Strongest evidence for each position">
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {r.strongestEvidence.map((p, i) => (
              <li key={i} className="py-3">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{p.position}</p>
                <EvidenceChips ids={p.evidenceIds} byId={byId} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.unresolvedTensions.length > 0 && (
        <Section title="What remains unresolved">
          <InfoPoints points={r.unresolvedTensions} byId={byId} />
        </Section>
      )}

      {r.relationToBeliefs.length > 0 && (
        <Section title="Relation to your current beliefs">
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {r.relationToBeliefs.map((p, i) => (
              <Judgeable
                key={i}
                comparison={comparison}
                insightRef={`relation:${i}`}
                statement={p.statement}
                ids={p.evidenceIds}
                byId={byId}
              />
            ))}
          </ul>
        </Section>
      )}

      {r.questionsForUser.length > 0 && (
        <Section title="Questions for you">
          <ul className="list-disc pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {r.questionsForUser.map((q, i) => (
              <li key={i} className="mb-1">{q}</li>
            ))}
          </ul>
        </Section>
      )}

      {r.flagged && r.flagged.length > 0 && (
        <Section title="Flagged in review">
          <ul className="list-disc pl-5 text-sm text-amber-700 dark:text-amber-300">
            {r.flagged.map((f, i) => (
              <li key={i} className="mb-1">{f}</li>
            ))}
          </ul>
        </Section>
      )}

      {r.limitations.length > 0 && (
        <Section title="Limitations & coverage">
          <ul className="list-disc pl-5 text-sm text-zinc-500">
            {r.limitations.map((l, i) => (
              <li key={i} className="mb-1">{l}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
