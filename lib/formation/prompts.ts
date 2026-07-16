/**
 * Reflection prompt engine (LIFEOS-017, Phase 4).
 *
 * Deterministic, offline generation of thoughtful prompts drawn from the
 * user's OWN knowledge — questioned beliefs, recent revisions, unresolved
 * inquiries, aging decisions, recurring concepts. Prompts are examining, not
 * productive: never "what did you get done", never streaks or tasks. Nothing
 * here calls a model; the same state always yields the same prompts.
 */

import type { FormationSessionType, StoreState } from "@/types/mvp";

export interface FormationLinks {
  decisions?: string[];
  beliefs?: string[];
  practices?: string[];
  threads?: string[];
  inquiries?: string[];
  sources?: string[];
  reflections?: string[];
}

function snippet(s: string, n = 70): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function daysSince(iso?: string): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

/** Type-specific opening prompts — the framing question a session begins with. */
const OPENING: Record<FormationSessionType, string[]> = {
  morning: [
    "What matters most today, and why that and not something else?",
    "What are you tempted to avoid today, and what is under the avoidance?",
    "Who do you want to have been by tonight?",
  ],
  evening: [
    "What surprised you today?",
    "What did today ask of you that you didn't expect?",
    "Where did you act against what you believe — and where did you act from it?",
  ],
  decision_review: [
    "What did this decision reveal about what you actually value?",
    "What did you assume that turned out to be shakier than you thought?",
    "If you faced this choice again, what would you weigh differently?",
  ],
  book_integration: [
    "What in this reading pressed on a belief you already hold?",
    "What would you have to change if you took this seriously?",
    "Which line will you still remember in a year, and why that one?",
  ],
  conversation_review: [
    "What was really being said underneath what was said?",
    "What did this conversation change, confirm, or unsettle in you?",
    "What would you say now that you didn't say then?",
  ],
  failure_analysis: [
    "What did this cost, and what did it teach that nothing else could?",
    "Where was the earliest point you could have chosen differently?",
    "What belief made this failure more likely, and does it still hold?",
  ],
  success_analysis: [
    "What actually caused this — skill, circumstance, or someone else?",
    "What would you be wise not to conclude from this going well?",
    "What did this ask of you that you'd want to repeat on purpose?",
  ],
  conflict_reflection: [
    "What was each side actually protecting?",
    "Where were you more certain than the evidence warranted?",
    "What would it take for you to genuinely understand the other view?",
  ],
  practice_reflection: [
    "What is this practice actually forming in you — or not?",
    "Is this still worth doing, honestly, or has it become a ritual you've outgrown?",
    "What would you notice if you stopped?",
  ],
  open: [
    "What keeps resurfacing lately?",
    "What still feels unresolved?",
    "What would future-you thank you for examining now?",
  ],
  custom: [
    "What are you actually trying to understand here?",
    "What would you rather not look at about this?",
    "What still feels unresolved?",
  ],
};

/**
 * Build a set of prompts for a session. The first is the type's framing
 * question; the rest are drawn from the user's live knowledge so the prompt
 * is never generic. Capped and deterministic.
 */
export function generatePrompts(
  state: StoreState,
  type: FormationSessionType,
  links: FormationLinks = {},
): string[] {
  const prompts: string[] = [];
  const opening = OPENING[type] ?? OPENING.open;
  prompts.push(...opening.slice(0, 2));

  // A belief you marked questioned — invite you to sit with it.
  const questioned = state.beliefs
    .filter((b) => b.status === "questioned")
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
  if (questioned) {
    prompts.push(`You recently questioned: “${snippet(questioned.text)}”. What put pressure on it?`);
  }

  // A belief you revised — what changed you?
  const revised = state.beliefs
    .filter((b) => b.status === "revised" && daysSince(b.updatedAt) <= 30)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
  if (revised) {
    prompts.push(`“${snippet(revised.text)}” shifted recently. What evidence moved you — and do you trust it?`);
  }

  // An unresolved inquiry — what still won't settle?
  const openInquiry = state.inquiries
    .filter((i) => i.status === "unresolved" || i.status === "open")
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
  if (openInquiry) {
    prompts.push(`Your inquiry “${snippet(openInquiry.question)}” is still open. What are you avoiding deciding about it?`);
  }

  // A decision made a while ago with no outcome review — how did it actually go?
  const staleDecision = state.decisions
    .filter((d) => d.finalChoice && d.outcomeReviews.length === 0 && daysSince(d.updatedAt) >= 14)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
  if (staleDecision) {
    prompts.push(`You decided “${snippet(staleDecision.title, 50)}” a while ago. How has it actually turned out?`);
  }

  // A thread growing quickly — what is it becoming?
  const activeThread = state.megathreads
    .filter((t) => t.status === "active" && t.members.length >= 3 && daysSince(t.updatedAt) <= 21)
    .sort((a, b) => b.members.length - a.members.length)[0];
  if (activeThread) {
    prompts.push(`“${snippet(activeThread.title, 50)}” keeps drawing material to it. What is it really about for you?`);
  }

  // If this session links a specific record, add a targeted prompt.
  const linkedBelief = links.beliefs?.[0] && state.beliefs.find((b) => b.id === links.beliefs![0]);
  if (linkedBelief) prompts.push(`Sit with “${snippet(linkedBelief.text)}”. Where has your life confirmed or strained it?`);
  const linkedDecision = links.decisions?.[0] && state.decisions.find((d) => d.id === links.decisions![0]);
  if (linkedDecision) prompts.push(`Looking back at “${snippet(linkedDecision.title, 50)}”, what do you understand now that you didn't then?`);
  const linkedSource = links.sources?.[0] && state.sources.find((s) => s.id === links.sources![0]);
  if (linkedSource) prompts.push(`What from “${snippet(linkedSource.title, 50)}” do you want to actually carry into how you live?`);

  // Always close with the type's deepest opener.
  if (opening[2]) prompts.push(opening[2]);

  // Dedup, keep order, cap.
  const seen = new Set<string>();
  return prompts.filter((p) => (seen.has(p) ? false : (seen.add(p), true))).slice(0, 7);
}

export const SESSION_TYPE_LABEL: Record<FormationSessionType, string> = {
  morning: "Morning Reflection",
  evening: "Evening Reflection",
  decision_review: "Decision Review",
  book_integration: "Book Integration",
  conversation_review: "Conversation Review",
  failure_analysis: "Failure Analysis",
  success_analysis: "Success Analysis",
  conflict_reflection: "Conflict Reflection",
  practice_reflection: "Practice Reflection",
  open: "Open Reflection",
  custom: "Custom Reflection",
};
