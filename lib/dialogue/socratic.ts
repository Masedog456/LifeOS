/**
 * Socratic engine (LIFEOS-022, Phase 4).
 *
 * Generates DETERMINISTIC lines of inquiry — prompts, never answers. It does
 * NOT reason for the user, choose a position, or produce conversational replies
 * (this is not a chatbot). It instantiates the classic Socratic questions with
 * the dialogue's topic and its graph context (selected frameworks, contradicting
 * beliefs, related research), producing MULTIPLE lines of inquiry the user
 * chooses among. Pure and offline; no AI.
 */

import type { DialogueInquiry, DialogueSession, StoreState } from "@/types/mvp";
import { buildDialogueContext, type DialogueContext } from "@/lib/dialogue/context";

function id(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? `${prefix}_${crypto.randomUUID()}` : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
function snippet(s: string, n = 50): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

/**
 * Build the lines of inquiry for a dialogue. Always includes the core Socratic
 * moves; adds graph-grounded lines when the context supplies material.
 */
export function generateInquiries(state: StoreState, session: DialogueSession, context?: DialogueContext): DialogueInquiry[] {
  const ctx = context ?? buildDialogueContext(state, session);
  const topic = session.topic || session.title || "this idea";
  const out: DialogueInquiry[] = [];
  const add = (prompt: string, rationale: string, relatedIds: string[] = []) => out.push({ id: id("inq"), prompt, rationale, relatedIds });

  // The core Socratic moves — always available.
  add(`What do you mean by “${snippet(topic)}”? Define your terms precisely.`, "Clarify the concept before arguing about it.");
  add("What evidence supports this — and how strong is it?", "Ground the claim in what you actually know.", ctx.supportingBeliefs.map((b) => b.id));
  add("Could the opposite be true? State the strongest version of the contrary view.", "Steel-man the other side before dismissing it.", ctx.contradictingBeliefs.map((b) => b.id));
  add("What assumptions are hidden here — what are you taking for granted?", "Surface the premises doing the quiet work.");
  add("What follows if this is true? What else must then also be the case?", "Trace the consequences to test coherence.");
  add("What would falsify this? What observation would change your mind?", "A claim you can't imagine being wrong is not yet knowledge.");

  // Perspective-grounded: how would each selected framework/principle respond?
  for (const p of session.participants) {
    if (p.kind === "framework" || p.kind === "principle") {
      add(`How would “${snippet(p.label)}” respond to this?`, `Test the idea against the ${p.kind} you selected as a participant.`, p.refId ? [p.refId] : []);
    }
  }

  // Graph-grounded lines when material exists.
  if (ctx.contradictingBeliefs.length > 0) {
    const b = ctx.contradictingBeliefs[0];
    add(`You hold “${snippet(b.label)}”, which may conflict with this. How do you reconcile them?`, "A live contradiction in your own Constitution is worth facing.", [b.id]);
  }
  if (ctx.relatedResearch.length > 0) {
    const r = ctx.relatedResearch[0];
    add(`Your investigation “${snippet(r.label)}” bears on this — what did it actually establish?`, "Bring your own research to the question.", [r.id]);
  }
  if (ctx.decisionHistory.length > 0) {
    const d = ctx.decisionHistory[0];
    add(`Your decision “${snippet(d.label)}” touched this — did the outcome bear out the reasoning?`, "Let past choices inform present inquiry.", [d.id]);
  }
  if (ctx.relatedConcepts.length >= 2) {
    add(`How do “${snippet(ctx.relatedConcepts[0].label, 24)}” and “${snippet(ctx.relatedConcepts[1].label, 24)}” relate here — do they pull the same way?`, "Examine the concepts your model already connects to this.", ctx.relatedConcepts.slice(0, 2).map((c) => c.id));
  }

  return out;
}
