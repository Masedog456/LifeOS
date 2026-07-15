"use client";

import { useMemo, useState } from "react";
import type {
  ComparisonDecision,
  ComparisonPoint,
  EvidenceItem,
  Megathread,
} from "@/types/mvp";
import { judgeThreadInsight, sendToInbox } from "@/lib/mvpStore";

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
          <span key={id} title={e.text} className="inline-flex max-w-full items-center gap-1 rounded bg-black/[.05] px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-white/[.08] dark:text-zinc-400">
            <span className="font-mono text-[10px] text-zinc-400">{id}</span>
            <span className="truncate">{prov}: “{truncate(e.text, 60)}”</span>
          </span>
        );
      })}
    </div>
  );
}

function Judgeable({
  thread, insightRef, statement, ids, byId, source,
}: {
  thread: Megathread;
  insightRef: string;
  statement: string;
  ids: string[];
  byId: Map<string, EvidenceItem>;
  source: "ai" | "mock";
}) {
  const existing = thread.judgments.find((j) => j.insightRef === insightRef);
  const [decision, setDecision] = useState<ComparisonDecision | null>(existing?.decision ?? null);

  function act(d: ComparisonDecision) {
    if (d === "accepted") sendToInbox(statement, [{ claim: statement }], source);
    judgeThreadInsight(thread.id, insightRef, d);
    setDecision(d);
  }

  return (
    <li className="py-3">
      <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{statement}</p>
      <EvidenceChips ids={ids} byId={byId} />
      {decision ? (
        <p className="mt-1.5 text-xs text-zinc-400">
          {decision === "accepted" ? "→ Sent to your Belief Inbox." : decision === "questioned" ? "Marked as questioned." : "Rejected."}
          <button type="button" onClick={() => setDecision(null)} className="ml-2 underline-offset-4 hover:underline">change</button>
        </p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
          <button type="button" onClick={() => act("accepted")} className="rounded-full border border-black/[.12] px-2.5 py-1 hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]">Accept → Inbox</button>
          <button type="button" onClick={() => act("questioned")} className="rounded-full px-2.5 py-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">Question</button>
          <button type="button" onClick={() => act("rejected")} className="rounded-full px-2.5 py-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">Reject</button>
        </div>
      )}
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h3>
      {children}
    </section>
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

function List({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={`list-disc pl-5 text-sm ${className ?? "text-zinc-700 dark:text-zinc-300"}`}>
      {items.map((x, i) => <li key={i} className="mb-1">{x}</li>)}
    </ul>
  );
}

export default function ThreadSynthesis({ thread }: { thread: Megathread }) {
  const r = thread.synthesis;
  const source = thread.synthesisSource === "ai" ? "ai" : "mock";
  const byId = useMemo(() => new Map((thread.synthesisEvidence ?? []).map((e) => [e.id, e])), [thread.synthesisEvidence]);
  if (!r) return null;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-zinc-400">
        A cautious, living synthesis — accept an insight to review it in your Belief Inbox.
        Nothing here changes your Constitution automatically.
      </p>

      {r.currentUnderstanding && (
        <Section title="Current understanding">
          <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{r.currentUnderstanding}</p>
        </Section>
      )}

      {r.beliefEvolution.length > 0 && (
        <Section title="How your belief evolved"><List items={r.beliefEvolution} /></Section>
      )}

      {r.majorPositions.length > 0 && (
        <Section title="Major source positions">
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {r.majorPositions.map((p, i) => (
              <Judgeable key={i} thread={thread} insightRef={`position:${i}`} statement={p.statement} ids={p.evidenceIds} byId={byId} source={source} />
            ))}
          </ul>
        </Section>
      )}

      {r.agreements.length > 0 && (
        <Section title="Agreements">
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {r.agreements.map((p, i) => (
              <Judgeable key={i} thread={thread} insightRef={`agreement:${i}`} statement={p.statement} ids={p.evidenceIds} byId={byId} source={source} />
            ))}
          </ul>
        </Section>
      )}

      {r.disagreements.length > 0 && (
        <Section title="Disagreements"><InfoPoints points={r.disagreements} byId={byId} /></Section>
      )}

      {r.terminologyDifferences.length > 0 && (
        <Section title="Terminology differences">
          <ul className="flex flex-col gap-3">
            {r.terminologyDifferences.map((t, i) => (
              <li key={i}>
                <p className="text-sm text-zinc-800 dark:text-zinc-200"><span className="font-medium">{t.term}</span> — {t.note}</p>
                <EvidenceChips ids={t.evidenceIds} byId={byId} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.strongestSupport.length > 0 && (
        <Section title="Strongest supporting evidence">
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {r.strongestSupport.map((p, i) => (
              <li key={i} className="py-3">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{p.position}</p>
                <EvidenceChips ids={p.evidenceIds} byId={byId} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.strongestChallenge.length > 0 && (
        <Section title="Strongest challenging evidence">
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {r.strongestChallenge.map((p, i) => (
              <li key={i} className="py-3">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{p.position}</p>
                <EvidenceChips ids={p.evidenceIds} byId={byId} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.recentChanges.length > 0 && (
        <Section title="Recent changes"><List items={r.recentChanges} /></Section>
      )}

      {r.flagged && r.flagged.length > 0 && (
        <Section title="Flagged in review"><List items={r.flagged} className="text-amber-700 dark:text-amber-300" /></Section>
      )}

      {r.limitations.length > 0 && (
        <Section title="Limitations & coverage"><List items={r.limitations} className="text-zinc-500" /></Section>
      )}
    </div>
  );
}
