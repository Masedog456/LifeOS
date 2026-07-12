"use client";

import { useMemo, useState } from "react";
import type {
  ComparisonDecision,
  DialecticPoint,
  EvidenceItem,
  Inquiry,
} from "@/types/mvp";
import { judgeInquiryInsight, sendToInbox } from "@/lib/mvpStore";

const ARG_LABEL: Record<string, string> = {
  premise: "premise", conclusion: "conclusion", objection: "objection", rebuttal: "rebuttal",
  qualification: "qualification", analogy: "analogy", definition: "definition", empirical: "empirical claim",
  interpretive: "interpretive claim", theological: "theological claim", personal_judgment: "personal judgment",
};
const FALLACY_LABEL: Record<string, string> = {
  invalid_inference: "invalid inference", hidden_assumption: "hidden assumption", equivocation: "equivocation",
  circular_reasoning: "circular reasoning", unsupported_generalization: "unsupported generalization",
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

function Judgeable({
  inquiry, insightRef, statement, argType, ids, byId,
}: {
  inquiry: Inquiry;
  insightRef: string;
  statement: string;
  argType?: string;
  ids: string[];
  byId: Map<string, EvidenceItem>;
}) {
  const existing = inquiry.judgments.find((j) => j.insightRef === insightRef);
  const [decision, setDecision] = useState<ComparisonDecision | null>(existing?.decision ?? null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(statement);

  function act(text: string, d: ComparisonDecision) {
    if (d === "accepted" || d === "rewritten") sendToInbox(text, [{ claim: text }], inquiry.source);
    judgeInquiryInsight(inquiry.id, insightRef, d);
    setDecision(d);
    setEditing(false);
  }

  return (
    <li className="py-3">
      {argType && (
        <span className="mb-1 inline-block rounded bg-black/[.05] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-white/[.08]">
          {ARG_LABEL[argType] ?? argType}
        </span>
      )}
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
            <button type="button" onClick={() => act(draft.trim() || statement, "rewritten")} className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900">
              Send rewrite to Inbox
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-full px-3 py-1 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
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

function InfoPoints({ points, byId }: { points: DialecticPoint[]; byId: Map<string, EvidenceItem> }) {
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

function JudgeableGroup({
  inquiry, refPrefix, points, byId,
}: {
  inquiry: Inquiry;
  refPrefix: string;
  points: DialecticPoint[];
  byId: Map<string, EvidenceItem>;
}) {
  return (
    <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
      {points.map((p, i) => (
        <Judgeable
          key={i}
          inquiry={inquiry}
          insightRef={`${refPrefix}:${i}`}
          statement={p.statement}
          argType={p.argType}
          ids={p.evidenceIds}
          byId={byId}
        />
      ))}
    </ul>
  );
}

export default function DialecticResult({ inquiry }: { inquiry: Inquiry }) {
  const r = inquiry.result;
  const byId = useMemo(() => new Map(inquiry.evidence.map((e) => [e.id, e])), [inquiry.evidence]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span className="rounded bg-black/[.05] px-1.5 py-0.5 dark:bg-white/[.08]">{inquiry.source === "ai" ? "AI" : "mock"}</span>
          {inquiry.verified && <span>· verified</span>}
          <span>· {inquiry.status}</span>
          <span>· {new Date(inquiry.createdAt).toLocaleDateString()}</span>
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{r.question}</h1>
      </header>

      {inquiry.partial && (
        <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          ⚠︎ {r.coverageNote}
        </p>
      )}

      <p className="text-xs text-zinc-400">
        This is a reasoning aid, not a verdict — accept an insight to review it in your Belief Inbox.
        Nothing here changes your Constitution automatically.
      </p>

      {r.definitions.length > 0 && (
        <Section title="Definitions">
          <ul className="flex flex-col gap-2">
            {r.definitions.map((d, i) => (
              <li key={i} className="text-sm text-zinc-800 dark:text-zinc-200">
                <span className="font-medium">{d.term}</span> — {d.definition}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.assumptions.length > 0 && (
        <Section title="Assumptions"><InfoPoints points={r.assumptions} byId={byId} /></Section>
      )}

      {r.affirmativeCase.length > 0 && (
        <Section title="Strongest affirmative case">
          <JudgeableGroup inquiry={inquiry} refPrefix="affirmative" points={r.affirmativeCase} byId={byId} />
        </Section>
      )}

      {r.negativeCase.length > 0 && (
        <Section title="Strongest negative case">
          <JudgeableGroup inquiry={inquiry} refPrefix="negative" points={r.negativeCase} byId={byId} />
        </Section>
      )}

      {r.supportingEvidence.length > 0 && (
        <Section title="Supporting evidence">
          <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
            {r.supportingEvidence.map((p, i) => (
              <li key={i} className="py-3">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{p.position}</p>
                <EvidenceChips ids={p.evidenceIds} byId={byId} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.counterarguments.length > 0 && (
        <Section title="Counterarguments">
          <JudgeableGroup inquiry={inquiry} refPrefix="counter" points={r.counterarguments} byId={byId} />
        </Section>
      )}

      {r.rebuttals.length > 0 && (
        <Section title="Rebuttals"><InfoPoints points={r.rebuttals} byId={byId} /></Section>
      )}

      {r.terminologyDisputes.length > 0 && (
        <Section title="Terminology disputes">
          <ul className="flex flex-col gap-3">
            {r.terminologyDisputes.map((t, i) => (
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

      {r.distinctions.length > 0 && (
        <Section title="Distinctions"><List items={r.distinctions} /></Section>
      )}

      {r.reasoningIssues.length > 0 && (
        <Section title="Reasoning issues">
          <ul className="flex flex-col gap-2">
            {r.reasoningIssues.map((x, i) => (
              <li key={i} className="text-sm text-zinc-700 dark:text-zinc-300">
                <span className="mr-2 rounded bg-black/[.05] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-white/[.08]">
                  {FALLACY_LABEL[x.kind] ?? x.kind}
                </span>
                {x.note}
                <EvidenceChips ids={x.evidenceIds} byId={byId} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.unresolvedAmbiguities.length > 0 && (
        <Section title="Unresolved ambiguities"><List items={r.unresolvedAmbiguities} /></Section>
      )}

      {r.possibleSyntheses.length > 0 && (
        <Section title="Possible syntheses"><InfoPoints points={r.possibleSyntheses} byId={byId} /></Section>
      )}

      {r.evidenceThatWouldChange.length > 0 && (
        <Section title="What evidence would change the conclusion"><List items={r.evidenceThatWouldChange} /></Section>
      )}

      {r.relationToBeliefs.length > 0 && (
        <Section title="Relation to your current beliefs">
          <JudgeableGroup inquiry={inquiry} refPrefix="relation" points={r.relationToBeliefs} byId={byId} />
        </Section>
      )}

      {r.questionsForHuman.length > 0 && (
        <Section title="Questions requiring your judgment"><List items={r.questionsForHuman} /></Section>
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
