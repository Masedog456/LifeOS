"use client";

import { useMemo, useState } from "react";
import type {
  ComparisonDecision,
  EvidenceItem,
  FormationFinding,
  FormationSession,
} from "@/types/mvp";
import { judgeFormationInsight, sendToInbox } from "@/lib/mvpStore";

function truncate(s: string, n = 56): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function Chips({ ids, byId }: { ids: string[]; byId: Map<string, EvidenceItem> }) {
  if (!ids.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const e = byId.get(id);
        if (!e) return null;
        return (
          <span key={id} title={e.text} className="inline-flex max-w-full items-center gap-1 rounded bg-black/[.05] px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-white/[.08] dark:text-zinc-400">
            <span className="font-mono text-[10px] text-zinc-400">{e.group}</span>
            <span className="truncate">{truncate(e.text)}</span>
          </span>
        );
      })}
    </div>
  );
}

function Judgeable({
  session, insightRef, statement, ids, byId,
}: {
  session: FormationSession;
  insightRef: string;
  statement: string;
  ids: string[];
  byId: Map<string, EvidenceItem>;
}) {
  const existing = session.judgments.find((j) => j.insightRef === insightRef);
  const [verdict, setVerdict] = useState<ComparisonDecision | null>(existing?.decision ?? null);

  function act(d: ComparisonDecision) {
    if (d === "accepted") sendToInbox(statement, [{ claim: statement }], session.source);
    judgeFormationInsight(session.id, insightRef, d);
    setVerdict(d);
  }

  return (
    <li className="py-3">
      <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{statement}</p>
      <Chips ids={ids} byId={byId} />
      {verdict ? (
        <p className="mt-1.5 text-xs text-zinc-400">
          {verdict === "accepted" ? "→ Sent to your Belief Inbox." : verdict === "questioned" ? "Marked to question." : "Set aside."}
          <button type="button" onClick={() => setVerdict(null)} className="ml-2 underline-offset-4 hover:underline">change</button>
        </p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
          <button type="button" onClick={() => act("accepted")} className="rounded-full border border-black/[.12] px-2.5 py-1 hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]">Accept → Inbox</button>
          <button type="button" onClick={() => act("questioned")} className="rounded-full px-2.5 py-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">Question</button>
          <button type="button" onClick={() => act("rejected")} className="rounded-full px-2.5 py-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">Set aside</button>
        </div>
      )}
    </li>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
      {hint && <p className="mb-1 text-xs text-zinc-400">{hint}</p>}
      {children}
    </section>
  );
}

function List({ items, className }: { items: string[]; className?: string }) {
  return <ul className={`list-disc pl-5 text-sm ${className ?? "text-zinc-700 dark:text-zinc-300"}`}>{items.map((x, i) => <li key={i} className="mb-1">{x}</li>)}</ul>;
}

function FindingList({ session, refPrefix, findings, byId }: { session: FormationSession; refPrefix: string; findings: FormationFinding[]; byId: Map<string, EvidenceItem> }) {
  return (
    <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
      {findings.map((f, i) => (
        <Judgeable key={i} session={session} insightRef={`${refPrefix}:${i}`} statement={f.statement} ids={f.evidenceIds} byId={byId} />
      ))}
    </ul>
  );
}

export default function FormationSynthesisView({ session }: { session: FormationSession }) {
  const s = session.synthesis;
  const byId = useMemo(() => new Map(session.evidence.map((e) => [e.id, e])), [session.evidence]);
  if (!s) return null;

  return (
    <div className="flex flex-col gap-8">
      <p className="text-xs text-zinc-400">
        This synthesis surfaces possibilities — it never concludes for you. Accept an insight to review it
        in your Belief Inbox; nothing changes your Constitution, decisions, or threads on its own.
      </p>

      {s.themes.length > 0 && <Section title="Themes"><List items={s.themes} /></Section>}
      {s.recurringTensions.length > 0 && <Section title="Recurring tensions"><List items={s.recurringTensions} /></Section>}

      {s.possibleBeliefRevisions.length > 0 && (
        <Section title="Beliefs this may bear on" hint="Suggestions grounded in your records — accept to send to your Inbox, never applied automatically.">
          <FindingList session={session} refPrefix="belief" findings={s.possibleBeliefRevisions} byId={byId} />
        </Section>
      )}

      {s.possibleDecisionFollowups.length > 0 && <Section title="Possible decision follow-ups"><List items={s.possibleDecisionFollowups} /></Section>}
      {s.possibleInquiryFollowups.length > 0 && <Section title="Possible inquiry follow-ups"><List items={s.possibleInquiryFollowups} /></Section>}
      {s.possibleThreadAdditions.length > 0 && <Section title="Might belong to a thread"><List items={s.possibleThreadAdditions} /></Section>}
      {s.possiblePractices.length > 0 && <Section title="Possible practices" hint="Small and optional — no scheduling, no streaks."><List items={s.possiblePractices} /></Section>}
      {s.questionsWorthRevisiting.length > 0 && <Section title="Questions worth revisiting"><List items={s.questionsWorthRevisiting} /></Section>}
      {s.itemsNeedingEvidence.length > 0 && <Section title="What still needs evidence"><List items={s.itemsNeedingEvidence} /></Section>}

      {s.flagged && s.flagged.length > 0 && <Section title="Flagged in review"><List items={s.flagged} className="text-amber-700 dark:text-amber-300" /></Section>}
      {s.limitations.length > 0 && <Section title="Limitations & coverage"><List items={[...s.limitations, s.coverageNote].filter(Boolean)} className="text-zinc-500" /></Section>}
    </div>
  );
}
