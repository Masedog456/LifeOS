"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import type {
  Decision,
  DecisionOption,
  DecisionStatus,
  OptionKind,
  Reversibility,
  UserConfidence,
} from "@/types/mvp";
import {
  addOutcomeReview,
  attachDecisionToThread,
  decisionById,
  getStoreSnapshot,
  removeDecisionCriterion,
  removeDecisionOption,
  reopenDecision,
  setDecisionAnalysis,
  setDecisionFields,
  setDecisionRating,
  setDecisionStatus,
  setFinalChoice,
  setProvisionalChoice,
  upsertDecisionCriterion,
  upsertDecisionOption,
  useStore,
} from "@/lib/mvpStore";
import { estimateDecisionAnalysis, runDecisionAnalysis, MAX_OPTIONS, MAX_CRITERIA } from "@/lib/decision/run";
import { computeTradeoffs } from "@/lib/decision/tradeoffs";
import { decisionDeps } from "@/lib/freshness/fingerprint";
import DecisionAnalysisView from "@/components/DecisionAnalysisView";
import FreshnessBadge from "@/components/FreshnessBadge";

const STATUSES: DecisionStatus[] = ["exploring", "narrowed", "decided", "deferred", "abandoned"];
const KINDS: { kind: OptionKind; label: string }[] = [
  { kind: "named", label: "Named" },
  { kind: "do_nothing", label: "Do nothing" },
  { kind: "defer", label: "Defer" },
  { kind: "hybrid", label: "Hybrid" },
];
const REVERSIBILITY: { value: Reversibility; label: string }[] = [
  { value: "unknown", label: "Reversibility: unknown" },
  { value: "easily_reversible", label: "Easily reversible" },
  { value: "costly_to_reverse", label: "Costly to reverse" },
  { value: "irreversible", label: "Effectively irreversible" },
];
const RATINGS = [
  { value: 2, label: "++" }, { value: 1, label: "+" }, { value: 0, label: "0" },
  { value: -1, label: "−" }, { value: -2, label: "−−" },
];

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
function lines(s: string): string[] {
  return s.split("\n").map((x) => x.trim()).filter(Boolean);
}

function OptionEditor({ decision, option }: { decision: Decision; option: DecisionOption }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(option.description ?? "");
  const [reversibility, setReversibility] = useState<Reversibility>(option.reversibility);
  const [timeHorizon, setTimeHorizon] = useState(option.timeHorizon ?? "");
  const [benefits, setBenefits] = useState(option.benefits.join("\n"));
  const [costs, setCosts] = useState(option.costs.join("\n"));
  const [risks, setRisks] = useState(option.risks.join("\n"));
  const [assumptions, setAssumptions] = useState(option.assumptions.join("\n"));
  const [questions, setQuestions] = useState(option.openQuestions.join("\n"));

  function save() {
    upsertDecisionOption(decision.id, {
      ...option,
      description: description.trim() || undefined,
      reversibility,
      timeHorizon: timeHorizon.trim() || undefined,
      benefits: lines(benefits),
      costs: lines(costs),
      risks: lines(risks),
      assumptions: lines(assumptions),
      openQuestions: lines(questions),
      aiSuggested: false, // saving = user approval
    });
    setOpen(false);
  }

  return (
    <li className="py-2">
      <div className="flex items-start gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex-1 text-left">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{option.name}</span>
          <span className="ml-2 text-xs text-zinc-400">
            {KINDS.find((k) => k.kind === option.kind)?.label}
            {option.reversibility !== "unknown" && ` · ${REVERSIBILITY.find((r) => r.value === option.reversibility)?.label.toLowerCase()}`}
            {option.aiSuggested && " · AI-suggested (approve by editing)"}
          </span>
        </button>
        <button type="button" onClick={() => removeDecisionOption(decision.id, option.id)} className="shrink-0 text-xs text-zinc-400 hover:text-red-500">remove</button>
      </div>
      {open && (
        <div className="mt-2 flex flex-col gap-2 rounded-xl border border-black/[.06] p-3 dark:border-white/[.08]">
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="w-full rounded-lg border border-black/[.10] bg-transparent px-2.5 py-1.5 text-sm outline-none dark:border-white/[.12]" />
          <div className="flex flex-wrap gap-2">
            <select value={reversibility} onChange={(e) => setReversibility(e.target.value as Reversibility)} className="rounded-lg border border-black/[.10] bg-transparent px-2 py-1.5 text-xs outline-none dark:border-white/[.12]">
              {REVERSIBILITY.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <input value={timeHorizon} onChange={(e) => setTimeHorizon(e.target.value)} placeholder="Time horizon (e.g. 2 years)" className="flex-1 rounded-lg border border-black/[.10] bg-transparent px-2.5 py-1.5 text-xs outline-none dark:border-white/[.12]" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <textarea value={benefits} onChange={(e) => setBenefits(e.target.value)} rows={3} placeholder="Expected benefits (one per line)" className="rounded-lg border border-black/[.10] bg-transparent p-2 text-xs outline-none dark:border-white/[.12]" />
            <textarea value={costs} onChange={(e) => setCosts(e.target.value)} rows={3} placeholder="Expected costs (one per line)" className="rounded-lg border border-black/[.10] bg-transparent p-2 text-xs outline-none dark:border-white/[.12]" />
            <textarea value={risks} onChange={(e) => setRisks(e.target.value)} rows={3} placeholder="Risks (one per line)" className="rounded-lg border border-black/[.10] bg-transparent p-2 text-xs outline-none dark:border-white/[.12]" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <textarea value={assumptions} onChange={(e) => setAssumptions(e.target.value)} rows={2} placeholder="Assumptions (one per line)" className="rounded-lg border border-black/[.10] bg-transparent p-2 text-xs outline-none dark:border-white/[.12]" />
            <textarea value={questions} onChange={(e) => setQuestions(e.target.value)} rows={2} placeholder="Unanswered questions (one per line)" className="rounded-lg border border-black/[.10] bg-transparent p-2 text-xs outline-none dark:border-white/[.12]" />
          </div>
          <div>
            <button type="button" onClick={save} className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">Save option</button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function DecisionDetailPage() {
  const params = useParams<{ id: string }>();
  const state = useStore();
  const decision = decisionById(state, params.id);

  const [newOption, setNewOption] = useState("");
  const [newKind, setNewKind] = useState<OptionKind>("named");
  const [newCriterion, setNewCriterion] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmExpensive, setConfirmExpensive] = useState(false);
  const [finalOption, setFinalOption] = useState("");
  const [rationale, setRationale] = useState(decision?.rationale ?? "");
  const [confidence, setConfidence] = useState<UserConfidence>("medium");
  const [attachTo, setAttachTo] = useState("");
  const [attached, setAttached] = useState(false);
  // Outcome review form
  const [showReview, setShowReview] = useState(false);
  const [rvHappened, setRvHappened] = useState("");
  const [rvExpected, setRvExpected] = useState("");
  const [rvSurprises, setRvSurprises] = useState("");
  const [rvWrong, setRvWrong] = useState("");
  const [rvDifferently, setRvDifferently] = useState("");
  const [rvSound, setRvSound] = useState<"yes" | "partly" | "no">("yes");
  const [rvLessons, setRvLessons] = useState("");

  const tradeoffs = useMemo(() => (decision ? computeTradeoffs(decision) : null), [decision]);
  const est = useMemo(() => (decision ? estimateDecisionAnalysis(state, decision) : null), [state, decision]);

  if (!decision) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-zinc-600 dark:text-zinc-300">Decision not found.</p>
        <Link href="/decisions" className="text-sm text-zinc-500 underline-offset-4 hover:underline">← Back to Decisions</Link>
      </main>
    );
  }

  const chosen = decision.finalChoice ? decision.options.find((o) => o.id === decision.finalChoice) : undefined;

  function addOption() {
    if (!decision) return;
    const name = newKind === "do_nothing" ? "Do nothing" : newKind === "defer" ? "Defer the decision" : newOption.trim();
    if (!name || decision.options.length >= MAX_OPTIONS) return;
    upsertDecisionOption(decision.id, {
      id: newId(), name, kind: newKind, benefits: [], costs: [], risks: [],
      reversibility: newKind === "do_nothing" || newKind === "defer" ? "easily_reversible" : "unknown",
      evidenceIds: [], assumptions: [], openQuestions: [],
    });
    setNewOption("");
    setNewKind("named");
  }

  function addCriterion() {
    if (!decision || !newCriterion.trim() || decision.criteria.length >= MAX_CRITERIA) return;
    upsertDecisionCriterion(decision.id, { id: newId(), name: newCriterion.trim() });
    setNewCriterion("");
  }

  async function analyze() {
    if (!decision || running) return;
    if (est && est.calls >= 2 && !confirmExpensive) { setConfirmExpensive(true); return; }
    setRunning(true);
    setError(null);
    try {
      const r = await runDecisionAnalysis(getStoreSnapshot(), decision);
      setDecisionAnalysis(decision.id, r.analysis, r);
      setConfirmExpensive(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setRunning(false);
    }
  }

  function decide() {
    if (!decision || !finalOption) return;
    setFinalChoice(decision.id, finalOption, rationale, confidence);
  }

  function saveReview() {
    if (!decision || !rvHappened.trim()) return;
    addOutcomeReview(decision.id, {
      at: new Date().toISOString(),
      whatHappened: rvHappened.trim(),
      expected: rvExpected.trim() || undefined,
      surprises: rvSurprises.trim() || undefined,
      wrongAssumptions: rvWrong.trim() || undefined,
      doDifferently: rvDifferently.trim() || undefined,
      stillSound: rvSound,
      lessons: lines(rvLessons),
    });
    setShowReview(false);
    setRvHappened(""); setRvExpected(""); setRvSurprises(""); setRvWrong(""); setRvDifferently(""); setRvLessons("");
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link href="/decisions" className="text-sm text-zinc-500 underline-offset-4 hover:underline">← Decisions</Link>

      <header className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{decision.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{decision.question}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span>Status:</span>
          {STATUSES.map((s) => (
            <button key={s} type="button" onClick={() => setDecisionStatus(decision.id, s)}
              className={`rounded-full px-2.5 py-0.5 transition-colors ${decision.status === s ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-black/[.10] hover:text-zinc-900 dark:border-white/[.12] dark:hover:text-zinc-100"}`}>
              {s}
            </button>
          ))}
        </div>
        {decision.sensitive && (
          <p className="mt-3 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {decision.sensitive}
          </p>
        )}
      </header>

      {/* Final decision banner */}
      {chosen && (
        <section className="mb-8 rounded-2xl border border-emerald-300/50 bg-emerald-50/60 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">You decided</p>
          <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{chosen.name}</p>
          {decision.rationale && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{decision.rationale}</p>}
          {decision.userConfidence && <p className="mt-1 text-xs text-zinc-400">Your stated confidence: {decision.userConfidence}</p>}
          <div className="mt-2 flex gap-3">
            <button type="button" onClick={() => reopenDecision(decision.id)} className="text-xs text-zinc-500 underline-offset-4 hover:underline">Reopen</button>
            <button type="button" onClick={() => setShowReview((v) => !v)} className="text-xs text-zinc-500 underline-offset-4 hover:underline">
              {showReview ? "Close outcome review" : "Write an outcome review"}
            </button>
          </div>
        </section>
      )}

      {/* Outcome review form + list */}
      {showReview && (
        <section className="mb-8 rounded-2xl border border-black/[.06] p-4 dark:border-white/[.08]">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Outcome review (reflective, not a score)</h2>
          <textarea value={rvHappened} onChange={(e) => setRvHappened(e.target.value)} rows={2} placeholder="What happened?" className="mt-2 w-full resize-none rounded-lg border border-black/[.10] bg-transparent p-2 text-sm outline-none dark:border-white/[.12]" />
          <textarea value={rvExpected} onChange={(e) => setRvExpected(e.target.value)} rows={1} placeholder="What did you expect?" className="mt-2 w-full resize-none rounded-lg border border-black/[.10] bg-transparent p-2 text-sm outline-none dark:border-white/[.12]" />
          <textarea value={rvSurprises} onChange={(e) => setRvSurprises(e.target.value)} rows={1} placeholder="What surprised you?" className="mt-2 w-full resize-none rounded-lg border border-black/[.10] bg-transparent p-2 text-sm outline-none dark:border-white/[.12]" />
          <textarea value={rvWrong} onChange={(e) => setRvWrong(e.target.value)} rows={1} placeholder="Which assumptions were wrong?" className="mt-2 w-full resize-none rounded-lg border border-black/[.10] bg-transparent p-2 text-sm outline-none dark:border-white/[.12]" />
          <textarea value={rvDifferently} onChange={(e) => setRvDifferently(e.target.value)} rows={1} placeholder="What would you do differently?" className="mt-2 w-full resize-none rounded-lg border border-black/[.10] bg-transparent p-2 text-sm outline-none dark:border-white/[.12]" />
          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
            <span>Does the decision still seem sound?</span>
            {(["yes", "partly", "no"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setRvSound(v)} className={`rounded-full px-2.5 py-0.5 ${rvSound === v ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-black/[.10] dark:border-white/[.12]"}`}>{v}</button>
            ))}
          </div>
          <textarea value={rvLessons} onChange={(e) => setRvLessons(e.target.value)} rows={2} placeholder="Lessons (one per line) — you can send them to your Belief Inbox afterwards" className="mt-2 w-full resize-none rounded-lg border border-black/[.10] bg-transparent p-2 text-sm outline-none dark:border-white/[.12]" />
          <button type="button" onClick={saveReview} disabled={!rvHappened.trim()} className="mt-2 rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900">Save review</button>
        </section>
      )}
      {decision.outcomeReviews.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Outcome reviews</h2>
          <ul className="flex flex-col gap-3">
            {decision.outcomeReviews.map((r, i) => (
              <li key={i} className="rounded-xl border border-black/[.06] p-3 text-sm dark:border-white/[.08]">
                <p className="text-xs text-zinc-400">{new Date(r.at).toLocaleDateString()} · still sound: {r.stillSound ?? "—"}</p>
                <p className="mt-1 text-zinc-800 dark:text-zinc-200">{r.whatHappened}</p>
                {r.surprises && <p className="mt-1 text-xs text-zinc-500">Surprised you: {r.surprises}</p>}
                {r.wrongAssumptions && <p className="mt-1 text-xs text-zinc-500">Wrong assumptions: {r.wrongAssumptions}</p>}
                {r.lessons.length > 0 && <p className="mt-1 text-xs text-zinc-500">Lessons: {r.lessons.join(" · ")}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Options */}
      <section className="mb-8">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Options ({decision.options.length}/{MAX_OPTIONS})</h2>
        <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
          {decision.options.map((o) => <OptionEditor key={o.id} decision={decision} option={o} />)}
        </ul>
        {decision.options.length < MAX_OPTIONS && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5">
              {KINDS.map((k) => (
                <button key={k.kind} type="button" onClick={() => setNewKind(k.kind)} className={`rounded-full px-2.5 py-1 text-xs ${newKind === k.kind ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-black/[.10] text-zinc-500 dark:border-white/[.12]"}`}>{k.label}</button>
              ))}
            </div>
            {newKind !== "do_nothing" && newKind !== "defer" && (
              <input value={newOption} onChange={(e) => setNewOption(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addOption()} placeholder={newKind === "hybrid" ? "Name your hybrid option…" : "Option name…"} className="flex-1 rounded-lg border border-black/[.10] bg-transparent px-3 py-1.5 text-sm outline-none dark:border-white/[.12]" />
            )}
            <button type="button" onClick={addOption} className="rounded-full border border-black/[.12] px-3 py-1.5 text-xs dark:border-white/[.15]">Add option</button>
          </div>
        )}
      </section>

      {/* Criteria */}
      <section className="mb-8">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Criteria ({decision.criteria.length}/{MAX_CRITERIA})</h2>
        <p className="mb-2 text-xs text-zinc-400">Weights are optional and rough — weighted totals are one perspective, never the answer.</p>
        <ul className="flex flex-col gap-1.5">
          {decision.criteria.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <input
                defaultValue={c.name}
                onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.name && upsertDecisionCriterion(decision.id, { ...c, name: e.target.value.trim() })}
                className="flex-1 rounded-lg border border-black/[.10] bg-transparent px-2.5 py-1 text-sm outline-none dark:border-white/[.12]"
              />
              <select value={c.weight ?? ""} onChange={(e) => upsertDecisionCriterion(decision.id, { ...c, weight: e.target.value ? Number(e.target.value) : undefined })} className="rounded-lg border border-black/[.10] bg-transparent px-2 py-1 text-xs outline-none dark:border-white/[.12]">
                <option value="">weight —</option>
                {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>weight {w}</option>)}
              </select>
              <button type="button" onClick={() => removeDecisionCriterion(decision.id, c.id)} className="text-xs text-zinc-400 hover:text-red-500">remove</button>
            </li>
          ))}
        </ul>
        {decision.criteria.length < MAX_CRITERIA && (
          <div className="mt-2 flex gap-2">
            <input value={newCriterion} onChange={(e) => setNewCriterion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCriterion()} placeholder="Add a criterion (e.g. alignment with beliefs, family impact)…" className="flex-1 rounded-lg border border-black/[.10] bg-transparent px-3 py-1.5 text-sm outline-none dark:border-white/[.12]" />
            <button type="button" onClick={addCriterion} className="rounded-full border border-black/[.12] px-3 py-1.5 text-xs dark:border-white/[.15]">Add</button>
          </div>
        )}
      </section>

      {/* Ratings grid + deterministic tradeoffs */}
      {decision.options.length > 0 && decision.criteria.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Your ratings (−− to ++)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="pb-1 pr-2 font-medium text-zinc-400">Option</th>
                  {decision.criteria.map((c) => <th key={c.id} className="pb-1 pr-2 font-medium text-zinc-400">{c.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {decision.options.map((o) => (
                  <tr key={o.id} className="border-t border-black/[.05] dark:border-white/[.06]">
                    <td className="py-1.5 pr-2 text-sm text-zinc-800 dark:text-zinc-200">{o.name}</td>
                    {decision.criteria.map((c) => (
                      <td key={c.id} className="py-1.5 pr-2">
                        <select
                          value={decision.ratings[o.id]?.[c.id] ?? ""}
                          onChange={(e) => setDecisionRating(decision.id, o.id, c.id, Number(e.target.value))}
                          className="rounded border border-black/[.10] bg-transparent px-1 py-0.5 outline-none dark:border-white/[.12]"
                        >
                          <option value="">–</option>
                          {RATINGS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tradeoffs && !tradeoffs.empty && (
            <div className="mt-3 rounded-xl border border-black/[.06] p-3 dark:border-white/[.08]">
              <p className="text-xs font-medium text-zinc-500">One perspective — your weights × your ratings (not the answer):</p>
              <ul className="mt-1 flex flex-col gap-0.5 text-sm text-zinc-700 dark:text-zinc-300">
                {tradeoffs.tallies.map((t) => (
                  <li key={t.optionId}>{t.optionName}: <span className="font-medium">{t.weightedTotal > 0 ? "+" : ""}{t.weightedTotal}</span> <span className="text-xs text-zinc-400">({t.ratedCriteria}/{t.totalCriteria} criteria rated)</span></li>
                ))}
              </ul>
              {tradeoffs.leaders.length > 0 && (
                <p className="mt-1 text-xs text-zinc-400">
                  {tradeoffs.leaders.map((l) => `${l.criterionName}: ${l.leaders.join(" / ")}`).join(" · ")}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Analysis */}
      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Analysis</h2>
          <button type="button" onClick={analyze} disabled={running || (est?.tooFewOptions ?? true)} className="rounded-full border border-black/[.12] px-3 py-1 text-xs hover:bg-black/[.04] disabled:opacity-40 dark:border-white/[.15] dark:hover:bg-white/[.06]">
            {running ? "Analyzing…" : confirmExpensive ? "Confirm & run" : decision.analysis ? "Re-run analysis" : `Run analysis (~${est?.calls ?? 1} AI call${(est?.calls ?? 1) === 1 ? "" : "s"})`}
          </button>
        </div>
        {est && (
          <p className="mb-2 text-xs text-zinc-400">
            {est.evidenceCount} evidence items from your records
            {est.tooFewOptions && <span className="ml-2 text-amber-600 dark:text-amber-400">Add at least 2 options first.</span>}
            {est.partial && <span className="ml-2 text-amber-600 dark:text-amber-400">⚠︎ {est.coverageNote}</span>}
          </p>
        )}
        {confirmExpensive && <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">Larger decision ({est?.calls} AI calls incl. verification). Click again to confirm.</p>}
        {error && <p className="mb-2 text-sm text-red-500">{error}</p>}

        {decision.analysis && (
          <div className="mb-4">
            <FreshnessBadge
              state={state}
              fingerprint={decision.fingerprint}
              currentIds={decisionDeps(decision)}
              approxAiCalls={est?.calls ?? 1}
              onRerun={analyze}
            />
          </div>
        )}
        {decision.analysis ? (
          <DecisionAnalysisView decision={decision} />
        ) : (
          <p className="text-sm text-zinc-400">
            Add options and criteria, then run an analysis grounded in your own records. Works fully
            offline (labeled mock) — with an AI key it reasons more deeply, but it still never chooses.
          </p>
        )}
        {decision.history.length > 0 && (
          <p className="mt-4 text-xs text-zinc-400">{decision.history.length} prior analysis result{decision.history.length === 1 ? "" : "s"} preserved in history.</p>
        )}
      </section>

      {/* Choice — explicit human action only */}
      {!chosen && decision.options.length >= 2 && (
        <section className="mb-8 rounded-2xl border border-black/[.06] p-5 dark:border-white/[.08]">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Your choice (nothing is chosen for you)</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span>Provisional lean:</span>
            {decision.options.map((o) => (
              <button key={o.id} type="button" onClick={() => setProvisionalChoice(decision.id, decision.provisionalChoice === o.id ? undefined : o.id)}
                className={`rounded-full px-2.5 py-0.5 ${decision.provisionalChoice === o.id ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-black/[.10] dark:border-white/[.12]"}`}>
                {o.name}
              </button>
            ))}
          </div>
          <div className="mt-4 border-t border-black/[.05] pt-3 dark:border-white/[.06]">
            <p className="text-xs text-zinc-400">Final choice — explicit and yours:</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select value={finalOption} onChange={(e) => setFinalOption(e.target.value)} className="rounded-lg border border-black/[.10] bg-transparent px-2.5 py-1.5 text-sm outline-none dark:border-white/[.12]">
                <option value="">— choose an option —</option>
                {decision.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <span className="text-xs text-zinc-400">Your confidence:</span>
              {(["low", "medium", "high"] as const).map((cv) => (
                <button key={cv} type="button" onClick={() => setConfidence(cv)} className={`rounded-full px-2.5 py-0.5 text-xs ${confidence === cv ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-black/[.10] text-zinc-500 dark:border-white/[.12]"}`}>{cv}</button>
              ))}
            </div>
            <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={2} placeholder="Your rationale, in your own words…" className="mt-2 w-full resize-none rounded-lg border border-black/[.10] bg-transparent p-2.5 text-sm outline-none dark:border-white/[.12]" />
            <button type="button" onClick={decide} disabled={!finalOption} className="mt-2 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900">
              Make final choice
            </button>
          </div>
        </section>
      )}

      {/* Attach to a Megathread */}
      {state.megathreads.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Attach to a Megathread</h2>
          <div className="flex items-center gap-2">
            <select value={attachTo} onChange={(e) => setAttachTo(e.target.value)} className="flex-1 rounded-lg border border-black/[.10] bg-transparent px-3 py-1.5 text-sm outline-none dark:border-white/[.12]">
              <option value="">— choose a thread —</option>
              {state.megathreads.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <button type="button" disabled={!attachTo} onClick={() => { attachDecisionToThread(decision.id, attachTo); setAttached(true); }} className="rounded-full border border-black/[.12] px-3 py-1.5 text-xs disabled:opacity-40 dark:border-white/[.15]">Attach</button>
          </div>
          {attached && <p className="mt-1 text-xs text-zinc-400">Attached — a note was added to the thread.</p>}
        </section>
      )}

      {/* Constraints & assumptions */}
      <section className="mb-8">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Constraints & assumptions</h2>
        <textarea
          defaultValue={decision.constraints.join("\n")}
          onBlur={(e) => setDecisionFields(decision.id, { constraints: lines(e.target.value) })}
          rows={2}
          placeholder="Constraints (one per line)…"
          className="w-full resize-none rounded-lg border border-black/[.10] bg-transparent p-2.5 text-sm outline-none dark:border-white/[.12]"
        />
        <textarea
          defaultValue={decision.assumptions.join("\n")}
          onBlur={(e) => setDecisionFields(decision.id, { assumptions: lines(e.target.value) })}
          rows={2}
          placeholder="Assumptions you're making (one per line)…"
          className="mt-2 w-full resize-none rounded-lg border border-black/[.10] bg-transparent p-2.5 text-sm outline-none dark:border-white/[.12]"
        />
      </section>
    </main>
  );
}
