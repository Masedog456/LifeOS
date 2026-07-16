"use client";

import { useMemo, useState } from "react";
import type {
  ComparisonDecision,
  Decision,
  DecisionFinding,
  EvidenceItem,
} from "@/types/mvp";
import { judgeDecisionInsight, sendToInbox } from "@/lib/mvpStore";

const REVERSIBILITY_LABEL: Record<string, string> = {
  easily_reversible: "easily reversible",
  costly_to_reverse: "costly to reverse",
  irreversible: "effectively irreversible",
  unknown: "unknown",
};
const VERDICT_LABEL: Record<string, string> = {
  supports: "may support",
  conflicts: "may conflict with",
  mixed: "is mixed against",
  unclear: "is unclear against",
};

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
  decision, insightRef, statement, ids, byId,
}: {
  decision: Decision;
  insightRef: string;
  statement: string;
  ids: string[];
  byId: Map<string, EvidenceItem>;
}) {
  const existing = decision.judgments.find((j) => j.insightRef === insightRef);
  const [verdict, setVerdict] = useState<ComparisonDecision | null>(existing?.decision ?? null);

  function act(d: ComparisonDecision) {
    if (d === "accepted") sendToInbox(statement, [{ claim: statement }], decision.source);
    judgeDecisionInsight(decision.id, insightRef, d);
    setVerdict(d);
  }

  return (
    <li className="py-3">
      <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{statement}</p>
      <Chips ids={ids} byId={byId} />
      {verdict ? (
        <p className="mt-1.5 text-xs text-zinc-400">
          {verdict === "accepted" ? "→ Sent to your Belief Inbox." : verdict === "questioned" ? "Marked questioned." : "Rejected."}
          <button type="button" onClick={() => setVerdict(null)} className="ml-2 underline-offset-4 hover:underline">change</button>
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
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
      {children}
    </section>
  );
}

function List({ items, className }: { items: string[]; className?: string }) {
  return <ul className={`list-disc pl-5 text-sm ${className ?? "text-zinc-700 dark:text-zinc-300"}`}>{items.map((x, i) => <li key={i} className="mb-1">{x}</li>)}</ul>;
}

function FindingList({ decision, refPrefix, findings, byId }: { decision: Decision; refPrefix: string; findings: DecisionFinding[]; byId: Map<string, EvidenceItem> }) {
  return (
    <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
      {findings.map((f, i) => (
        <Judgeable
          key={i}
          decision={decision}
          insightRef={`${refPrefix}:${i}`}
          statement={f.option ? `${f.option} — ${f.statement}` : f.statement}
          ids={f.evidenceIds}
          byId={byId}
        />
      ))}
    </ul>
  );
}

export default function DecisionAnalysisView({ decision }: { decision: Decision }) {
  const a = decision.analysis;
  const byId = useMemo(() => new Map(decision.evidence.map((e) => [e.id, e])), [decision.evidence]);
  if (!a) return null;

  return (
    <div className="flex flex-col gap-8">
      <p className="text-xs text-zinc-400">
        This analysis clarifies tradeoffs — it never chooses. Accept an insight to review it in your
        Belief Inbox; the decision itself stays entirely yours.
      </p>

      {a.tradeoffs.length > 0 && (
        <Section title="Tradeoffs">
          <FindingList decision={decision} refPrefix="tradeoff" findings={a.tradeoffs} byId={byId} />
        </Section>
      )}

      {a.valuesAlignment.length > 0 && (
        <Section title="Values alignment (never certainty)">
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {a.valuesAlignment.map((v, i) => (
              <li key={i} className="py-3">
                <span className="mb-1 inline-block rounded bg-black/[.05] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-white/[.08]">
                  {v.option} {VERDICT_LABEL[v.verdict] ?? v.verdict} a belief
                </span>
                <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{v.statement}</p>
                <Chips ids={v.evidenceIds} byId={byId} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {a.assumptions.length > 0 && (
        <Section title="Assumptions carrying weight">
          <FindingList decision={decision} refPrefix="assumption" findings={a.assumptions} byId={byId} />
        </Section>
      )}

      {a.missingEvidence.length > 0 && (
        <Section title="What you don't yet know"><List items={a.missingEvidence} /></Section>
      )}

      {a.risks.length > 0 && (
        <Section title="Risks">
          <FindingList decision={decision} refPrefix="risk" findings={a.risks} byId={byId} />
        </Section>
      )}

      {a.reversibilityNotes.length > 0 && (
        <Section title="Reversibility">
          <ul className="flex flex-col gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
            {a.reversibilityNotes.map((r, i) => (
              <li key={i}><span className="font-medium">{r.option}</span> — {REVERSIBILITY_LABEL[r.assessment] ?? r.assessment}{r.note ? `. ${r.note}` : ""}</li>
            ))}
          </ul>
        </Section>
      )}

      {(a.regret.regretDoing.length > 0 || a.regret.regretNotDoing.length > 0) && (
        <Section title="Regret analysis">
          {a.regret.regretDoing.length > 0 && (<><p className="mb-1 text-xs text-zinc-400">You might regret doing:</p><List items={a.regret.regretDoing} /></>)}
          {a.regret.regretNotDoing.length > 0 && (<><p className="mb-1 mt-2 text-xs text-zinc-400">You might regret not doing:</p><List items={a.regret.regretNotDoing} /></>)}
          {a.regret.recoverableRegrets.length > 0 && (<><p className="mb-1 mt-2 text-xs text-zinc-400">Recoverable:</p><List items={a.regret.recoverableRegrets} /></>)}
        </Section>
      )}

      {a.preMortem.length > 0 && (
        <Section title="Pre-mortem — imagine it failed">
          <div className="flex flex-col gap-4">
            {a.preMortem.map((p, i) => (
              <div key={i} className="rounded-xl border border-black/[.06] p-3 dark:border-white/[.08]">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{p.option}</p>
                {p.plausibleCauses.length > 0 && <p className="mt-1 text-xs text-zinc-500">Plausible causes: {p.plausibleCauses.join(" · ")}</p>}
                {p.preventableCauses.length > 0 && <p className="mt-1 text-xs text-zinc-500">Preventable: {p.preventableCauses.join(" · ")}</p>}
                {p.earlyWarningSigns.length > 0 && <p className="mt-1 text-xs text-zinc-500">Early warning signs: {p.earlyWarningSigns.join(" · ")}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {a.scenarios.length > 0 && (
        <Section title="Scenarios (no invented probabilities)">
          <div className="flex flex-col gap-4">
            {a.scenarios.map((s, i) => (
              <div key={i} className="rounded-xl border border-black/[.06] p-3 text-sm dark:border-white/[.08]">
                <p className="font-medium text-zinc-800 dark:text-zinc-200">{s.option}</p>
                {s.best && <p className="mt-1 text-zinc-600 dark:text-zinc-300"><span className="text-zinc-400">Best plausible:</span> {s.best}</p>}
                {s.expected && <p className="mt-1 text-zinc-600 dark:text-zinc-300"><span className="text-zinc-400">Expected:</span> {s.expected}</p>}
                {s.worst && <p className="mt-1 text-zinc-600 dark:text-zinc-300"><span className="text-zinc-400">Worst plausible:</span> {s.worst}</p>}
                {s.wildcard && <p className="mt-1 text-zinc-600 dark:text-zinc-300"><span className="text-zinc-400">Wildcard:</span> {s.wildcard}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {a.strongestFor.length > 0 && (
        <Section title="Strongest case for each option">
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {a.strongestFor.map((c, i) => (
              <li key={i} className="py-3">
                <p className="text-sm text-zinc-800 dark:text-zinc-200"><span className="font-medium">{c.option}</span> — {c.statement}</p>
                <Chips ids={c.evidenceIds} byId={byId} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {a.strongestAgainst.length > 0 && (
        <Section title="Strongest case against each option">
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {a.strongestAgainst.map((c, i) => (
              <li key={i} className="py-3">
                <p className="text-sm text-zinc-800 dark:text-zinc-200"><span className="font-medium">{c.option}</span> — {c.statement}</p>
                <Chips ids={c.evidenceIds} byId={byId} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {a.hybridSuggestion && (
        <Section title="Possible hybrid (yours to approve or ignore)">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{a.hybridSuggestion}</p>
        </Section>
      )}

      {a.keyUncertainties.length > 0 && <Section title="Key uncertainties"><List items={a.keyUncertainties} /></Section>}
      {a.whatWouldChange.length > 0 && <Section title="What would change this decision"><List items={a.whatWouldChange} /></Section>}
      {a.questionsForHuman.length > 0 && <Section title="Questions only you can answer"><List items={a.questionsForHuman} /></Section>}
      {a.flagged && a.flagged.length > 0 && <Section title="Flagged in review"><List items={a.flagged} className="text-amber-700 dark:text-amber-300" /></Section>}
      {a.limitations.length > 0 && <Section title="Limitations & coverage"><List items={a.limitations} className="text-zinc-500" /></Section>}
    </div>
  );
}
