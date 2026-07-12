/**
 * Practice candidates (LIFEOS-013, Phase 5).
 *
 * Small, modest, reviewable practices derived from an accepted belief or a
 * thread synthesis. Every candidate CITES its derivation. AI suggestions are
 * provisional and require explicit user acceptance. Guardrails reject medical,
 * legal, financial, or dangerous directives and moralizing language.
 */

import type { EvidenceItem, PracticeCadence, PracticeDerivation, StoreState } from "@/types/mvp";
import { suggestPractices } from "@/lib/aiClient";

/** Content the Formation Engine must never propose as a "practice". */
const UNSAFE =
  /\b(medication|medicine|dosage|dose|prescri\w*|diagnos\w*|symptom|therapy|antidepress\w*|lawsuit|sue|legal action|attorney|invest\w*|stocks?|crypto|portfolio|loan|debt|fast(ing)? for (days|a week)|starv\w*|purge|harm yourself|self-harm|suicid\w*|punish yourself)\b/i;
const MORALIZING = /\b(you must|you should|sinful|shame|repent|obligated|duty demands)\b/i;
const CADENCES: PracticeCadence[] = ["once", "daily", "weekly", "occasional"];

export interface PracticeDraft {
  title: string;
  description: string;
  rationale: string;
  cadence?: PracticeCadence;
  derivedFrom: PracticeDerivation;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Validate + guardrail AI/mock practice drafts. Unsafe/empty drafts are dropped. */
export function validatePractices(raw: unknown, derivedFrom: PracticeDerivation): { drafts: PracticeDraft[]; flagged: string[] } {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(obj.practices) ? obj.practices : Array.isArray(raw) ? raw : [];
  const drafts: PracticeDraft[] = [];
  const flagged: string[] = [];
  for (const p of list.slice(0, 6)) {
    const title = str((p as Record<string, unknown>)?.title);
    const description = str((p as Record<string, unknown>)?.description);
    const rationale = str((p as Record<string, unknown>)?.rationale);
    if (!title || !description) continue;
    const blob = `${title} ${description} ${rationale}`;
    if (UNSAFE.test(blob)) {
      flagged.push(`Rejected an unsafe practice suggestion ("${title.slice(0, 60)}").`);
      continue;
    }
    if (MORALIZING.test(blob)) {
      flagged.push(`Rejected a moralizing practice suggestion ("${title.slice(0, 60)}").`);
      continue;
    }
    const rawCadence = str((p as Record<string, unknown>)?.cadence) as PracticeCadence;
    drafts.push({
      title,
      description,
      rationale: rationale || "Derived from your current understanding.",
      cadence: CADENCES.includes(rawCadence) ? rawCadence : "occasional",
      derivedFrom,
    });
  }
  return { drafts: drafts.slice(0, 4), flagged };
}

/** Build the derivation packet (belief or thread) and suggest practices. */
export async function runPracticeSuggest(
  state: StoreState,
  seed: { beliefId?: string; threadId?: string; inquiryId?: string },
): Promise<{ drafts: PracticeDraft[]; flagged: string[]; source: "ai" | "mock" }> {
  const evidence: EvidenceItem[] = [];
  const derivedFrom: PracticeDerivation = {};

  if (seed.beliefId) {
    const b = state.beliefs.find((x) => x.id === seed.beliefId);
    if (b) {
      evidence.push({ id: b.id, kind: "belief", group: "Belief", text: b.text });
      derivedFrom.beliefIds = [b.id];
    }
  }
  if (seed.threadId) {
    const t = state.megathreads.find((x) => x.id === seed.threadId);
    if (t) {
      evidence.push({ id: t.id, kind: "metadata", group: "Thread", text: `${t.title}. ${t.synthesis?.currentUnderstanding ?? t.description ?? ""}` });
      derivedFrom.threadIds = [t.id];
    }
  }
  if (seed.inquiryId) {
    const i = state.inquiries.find((x) => x.id === seed.inquiryId);
    if (i) {
      evidence.push({ id: i.id, kind: "comparison_finding", group: "Inquiry", text: i.question });
      derivedFrom.inquiryIds = [i.id];
    }
  }

  const { result: raw, source } = await suggestPractices({ evidence });
  const { drafts, flagged } = validatePractices(raw, derivedFrom);
  return { drafts, flagged, source };
}
