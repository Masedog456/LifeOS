"use client";

import { useMemo, useState } from "react";
import type {
  ComparisonDecision,
  EvidenceItem,
  ReasoningFinding,
  ReasoningQuery,
} from "@/types/mvp";
import { judgeReasoningInsight, sendToInbox } from "@/lib/mvpStore";
import { MODE_LABEL } from "@/lib/reasoning/run";

const TENSION_LABEL: Record<string, string> = {
  logical: "possible contradiction",
  practical: "practical tension",
  definitional: "definitional difference",
  level_of_analysis: "different level of analysis",
  historical: "historical change",
  ambiguity: "unresolved ambiguity",
};

function truncate(s: string, n = 60): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function EvidenceChips({ ids, byId }: { ids: string[]; byId: Map<string, EvidenceItem> }) {
  if (!ids.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const e = byId.get(id);
        if (!e) return null;
        return (
          <span key={id} title={e.text} className="inline-flex max-w-full items-center gap-1 rounded bg-black/[.05] px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-white/[.08] dark:text-zinc-400">
            <span className="font-mono text-[10px] text-zinc-400">{e.group}</span>
            <span className="truncate">{truncate(e.text, 56)}</span>
          </span>
        );
      })}
    </div>
  );
}

function Judgeable({
  query, insightRef, statement, ids, byId,
}: {
  query: ReasoningQuery;
  insightRef: string;
  statement: string;
  ids: string[];
  byId: Map<string, EvidenceItem>;
}) {
  const existing = query.judgments.find((j) => j.insightRef === insightRef);
  const [decision, setDecision] = useState<ComparisonDecision | null>(existing?.decision ?? null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(statement);

  function act(text: string, d: ComparisonDecision) {
    if (d === "accepted" || d === "rewritten") sendToInbox(text, [{ claim: text }], query.source);
    judgeReasoningInsight(query.id, insightRef, d);
    setDecision(d);
    setEditing(false);
  }

  return (
    <li className="py-3">
      <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{statement}</p>
      <EvidenceChips ids={ids} byId={byId} />
      {editing ? (
        <div className="mt-2">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} autoFocus className="w-full resize-none rounded-lg border border-black/[.12] bg-transparent p-2 text-sm outline-none dark:border-white/[.15]" />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => act(draft.trim() || statement, "rewritten")} className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">Send rewrite to Inbox</button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-full px-3 py-1 text-xs text-zinc-400">Cancel</button>
          </div>
        </div>
      ) : decision ? (
        <p className="mt-1.5 text-xs text-zinc-400">
          {decision === "accepted" && "→ Sent to your Belief Inbox."}
          {decision === "rewritten" && "→ Rewritten and sent to your Belief Inbox."}
          {decision === "questioned" && "Marked as questioned."}
          {decision === "rejected" && "Rejected."}
          <button type="button" onClick={() => setDecision(null)} className="ml-2 underline-offset-4 hover:underline">change</button>
        </p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
          <button type="button" onClick={() => act(statement, "accepted")} className="rounded-full border border-black/[.12] px-2.5 py-1 hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]">Accept → Inbox</button>
          <button type="button" onClick={() => setEditing(true)} className="rounded-full border border-black/[.12] px-2.5 py-1 hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]">Rewrite</button>
          <button type="button" onClick={() => act(statement, "questioned")} className="rounded-full px-2.5 py-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">Question</button>
          <button type="button" onClick={() => act(statement, "rejected")} className="rounded-full px-2.5 py-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">Reject</button>
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

function InfoFindings({ findings, byId }: { findings: ReasoningFinding[]; byId: Map<string, EvidenceItem> }) {
  return (
    <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
      {findings.map((f, i) => (
        <li key={i} className="py-3">
          <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{f.statement}</p>
          <EvidenceChips ids={f.evidenceIds} byId={byId} />
        </li>
      ))}
    </ul>
  );
}

export default function ReasoningResult({ query }: { query: ReasoningQuery }) {
  const r = query.result;
  const byId = useMemo(() => new Map(query.evidence.map((e) => [e.id, e])), [query.evidence]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span className="rounded bg-black/[.05] px-1.5 py-0.5 dark:bg-white/[.08]">{MODE_LABEL[r.mode]}</span>
          <span>· {query.source === "ai" ? "AI" : "mock"}</span>
          {query.verified && <span>· verified</span>}
          <span>· {query.status}</span>
          <span>· {new Date(query.createdAt).toLocaleDateString()}</span>
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{r.question || MODE_LABEL[r.mode]}</h1>
        <p className="mt-1 text-xs text-zinc-400">Scope: {r.scopeSummary}</p>
      </header>

      {query.partial && (
        <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">⚠︎ {r.coverageNote}</p>
      )}

      <p className="text-xs text-zinc-400">
        Findings are grounded in your records — accept one to review it in your Belief Inbox.
        Nothing here changes your Constitution automatically.
      </p>

      {r.keyFindings.length > 0 && (
        <Section title="Key findings">
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {r.keyFindings.map((f, i) => <Judgeable key={i} query={query} insightRef={`finding:${i}`} statement={f.statement} ids={f.evidenceIds} byId={byId} />)}
          </ul>
        </Section>
      )}

      {r.supportAudits.length > 0 && (
        <Section title="Support audit (no truth scores)">
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {r.supportAudits.map((a) => (
              <li key={a.beliefId} className="py-3">
                <p className="text-sm text-zinc-800 dark:text-zinc-200">{a.beliefText}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {a.supportingSources} supporting source(s) · {a.challengingSources} challenging · {a.supportingQuotes} quote(s) · {a.revisions} revision(s) · {a.unresolvedQuestions} open question(s) · diversity {a.evidenceDiversity}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.supportingEvidence.length > 0 && (
        <Section title="Supporting evidence">
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {r.supportingEvidence.map((p, i) => (
              <li key={i} className="py-3"><p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{p.position}</p><EvidenceChips ids={p.evidenceIds} byId={byId} /></li>
            ))}
          </ul>
        </Section>
      )}

      {r.challengingEvidence.length > 0 && (
        <Section title="Challenging evidence">
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {r.challengingEvidence.map((p, i) => (
              <li key={i} className="py-3"><p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{p.position}</p><EvidenceChips ids={p.evidenceIds} byId={byId} /></li>
            ))}
          </ul>
        </Section>
      )}

      {r.candidateContradictions.length > 0 && (
        <Section title="Candidate tensions (not all contradictions)">
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {r.candidateContradictions.map((t, i) => {
              const ref = `contradiction:${i}`;
              const j = query.judgments.find((x) => x.insightRef === ref);
              return (
                <li key={i} className="py-3">
                  <span className="mb-1 inline-block rounded bg-black/[.05] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-white/[.08]">{TENSION_LABEL[t.kind] ?? t.kind}</span>
                  <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{t.statement}</p>
                  <EvidenceChips ids={t.evidenceIds} byId={byId} />
                  {j ? (
                    <p className="mt-1.5 text-xs text-zinc-400">{j.decision === "accepted" ? "Marked resolved." : "Marked unresolved."}</p>
                  ) : (
                    <div className="mt-1.5 flex gap-2 text-[11px]">
                      <button type="button" onClick={() => judgeReasoningInsight(query.id, ref, "accepted")} className="rounded-full border border-black/[.12] px-2.5 py-1 hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]">Mark resolved</button>
                      <button type="button" onClick={() => judgeReasoningInsight(query.id, ref, "questioned")} className="rounded-full px-2.5 py-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">Mark unresolved</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {r.assumptions.length > 0 && <Section title="Assumptions"><InfoFindings findings={r.assumptions} byId={byId} /></Section>}

      {r.influenceChains.length > 0 && (
        <Section title="Influence chains">
          <ul className="flex flex-col gap-2">
            {r.influenceChains.map((c, i) => (
              <li key={i} className="text-sm text-zinc-700 dark:text-zinc-300">
                {c.chain.join("  →  ")}
                <EvidenceChips ids={c.evidenceIds} byId={byId} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.affectedBeliefs.length > 0 && (
        <Section title="Beliefs / threads this could affect">
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {r.affectedBeliefs.map((f, i) => <Judgeable key={i} query={query} insightRef={`affected:${i}`} statement={f.statement} ids={f.evidenceIds} byId={byId} />)}
          </ul>
        </Section>
      )}

      {r.unresolvedQuestions.length > 0 && <Section title="Unresolved questions"><List items={r.unresolvedQuestions} /></Section>}
      {r.alternativeInterpretations.length > 0 && <Section title="Alternative interpretations"><List items={r.alternativeInterpretations} /></Section>}
      {r.questionsForHuman.length > 0 && <Section title="Questions for you"><List items={r.questionsForHuman} /></Section>}
      {r.flagged && r.flagged.length > 0 && <Section title="Flagged in review"><List items={r.flagged} className="text-amber-700 dark:text-amber-300" /></Section>}
      {r.limitations.length > 0 && <Section title="Limitations & coverage"><List items={r.limitations} className="text-zinc-500" /></Section>}
    </div>
  );
}
