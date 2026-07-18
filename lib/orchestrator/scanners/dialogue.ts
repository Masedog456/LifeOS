/**
 * Dialogue / Dialectic scanner (LIFEOS-024).
 *
 * Inspects the Dialogue Engine and Dialectical Synthesis only. Emits:
 *  - `unresolved_tension`       — a tension has stayed open;
 *  - `create_research_question` — a tension's syntheses keep failing;
 *  - `formation_exercise`       — a record recurs in tensions across dialogues;
 *  - `import_source`            — a dialogue cites a record that no longer exists;
 *  - `confidence_decline`       — a synthesis's confidence keeps dropping.
 */

import type { StoreState, Synthesis } from "@/types/mvp";
import { CONFIDENCE_ORDER } from "@/lib/dialectic/confidence";
import { proposal, type RecommendationProposal, type Scanner } from "@/lib/orchestrator/types";

const FAILED_SYNTHESIS_THRESHOLD = 2;
const CONFIDENCE_DROP_THRESHOLD = 2;

function knownIds(state: StoreState): Set<string> {
  const ids = new Set<string>();
  const add = (arr: { id: string }[]) => { for (const r of arr) ids.add(r.id); };
  add(state.beliefs); add(state.sources); add(state.concepts); add(state.principles);
  add(state.frameworks); add(state.megathreads); add(state.reasonings); add(state.decisions);
  add(state.formationSessions); add(state.researchProjects); add(state.knowledgeProjects);
  add(state.dialogueSessions);
  return ids;
}

function confidenceDrops(s: Synthesis): number {
  const axes = ["factual", "logical", "evidential", "experiential"] as const;
  let drops = 0;
  for (let i = 1; i < s.revisions.length; i++) {
    const prev = s.revisions[i - 1].confidence, cur = s.revisions[i].confidence;
    for (const ax of axes) {
      if (CONFIDENCE_ORDER.indexOf(cur[ax]) < CONFIDENCE_ORDER.indexOf(prev[ax])) drops++;
    }
  }
  return drops;
}

export const dialogueScanner: Scanner = (state: StoreState): RecommendationProposal[] => {
  const out: RecommendationProposal[] = [];
  const dialogueTitle = (id: string) => state.dialogueSessions.find((d) => d.id === id)?.title ?? "a dialogue";

  // unresolved_tension + create_research_question (per tension).
  for (const t of state.tensions) {
    if (t.status === "open" || t.status === "under_synthesis") {
      out.push(proposal({
        type: "unresolved_tension",
        priority: t.status === "under_synthesis" ? "medium" : "low",
        confidence: "moderate",
        subsystem: "dialogue",
        rationale: `The tension “${t.title}” in ${dialogueTitle(t.dialogueId)} is still ${t.status.replace(/_/g, " ")}.`,
        suggestedAction: "Return to the tension and work toward a synthesis.",
        actionHref: `/dialogue/${t.dialogueId}`,
        affected: [{ kind: "tension", id: t.id, label: t.title }],
      }));
    }
    const failed = state.syntheses.filter((s) => s.tensionIds.includes(t.id) && (s.status === "rejected" || s.status === "superseded")).length;
    if (failed >= FAILED_SYNTHESIS_THRESHOLD) {
      out.push(proposal({
        type: "create_research_question",
        priority: "medium",
        confidence: "moderate",
        subsystem: "dialogue",
        rationale: `${failed} syntheses for “${t.title}” have been rejected or superseded. The tension may need fresh evidence rather than another attempt.`,
        suggestedAction: "Open a research question to gather evidence for this tension.",
        actionHref: `/research?tension=${t.id}&topic=${encodeURIComponent(t.title)}`,
        affected: [{ kind: "tension", id: t.id, label: t.title }],
      }));
    }
  }

  // formation_exercise — a record recurring in tensions across ≥2 distinct dialogues.
  const refDialogues = new Map<string, { label: string; dialogues: Set<string> }>();
  for (const t of state.tensions) {
    for (const link of t.evidence) {
      const entry = refDialogues.get(link.refId) ?? { label: link.label, dialogues: new Set<string>() };
      entry.dialogues.add(t.dialogueId);
      refDialogues.set(link.refId, entry);
    }
  }
  for (const [refId, v] of refDialogues) {
    if (v.dialogues.size >= 2) {
      out.push(proposal({
        type: "formation_exercise",
        priority: "medium",
        confidence: "moderate",
        subsystem: "dialogue",
        rationale: `“${v.label}” keeps recurring as a source of tension across ${v.dialogues.size} dialogues. A formation reflection may help you sit with it rather than re-argue it.`,
        suggestedAction: "Start a formation reflection on the recurring conflict.",
        actionHref: `/formation?theme=${encodeURIComponent(v.label)}`,
        affected: [{ kind: "record", id: refId, label: v.label }],
      }));
    }
  }

  // import_source — a dialogue cites a record that no longer exists.
  const known = knownIds(state);
  for (const d of state.dialogueSessions) {
    const cited = new Set<string>([...d.seedRefs, ...d.turns.flatMap((t) => t.citations)]);
    const missing = [...cited].filter((id) => id && !known.has(id));
    if (missing.length > 0) {
      out.push(proposal({
        type: "import_source",
        priority: "low",
        confidence: "low",
        subsystem: "dialogue",
        rationale: `${dialogueTitle(d.id)} references ${missing.length} record(s) that are no longer in your library. Importing the source would restore the evidence.`,
        suggestedAction: "Import the missing source into your library.",
        actionHref: `/library`,
        affected: [{ kind: "dialogue", id: d.id, label: d.title }],
      }));
    }
  }

  // confidence_decline — a synthesis whose confidence keeps dropping.
  for (const s of state.syntheses) {
    const drops = confidenceDrops(s);
    if (drops >= CONFIDENCE_DROP_THRESHOLD) {
      out.push(proposal({
        type: "confidence_decline",
        priority: "medium",
        confidence: "high",
        subsystem: "dialogue",
        rationale: `Confidence in the synthesis “${s.statement.slice(0, 60)}…” has fallen ${drops} times across its revisions. This may be a signal worth surfacing rather than pushing past.`,
        suggestedAction: "Revisit the synthesis — the declining confidence may be telling you something.",
        actionHref: `/dialogue/${s.dialogueId}`,
        affected: [{ kind: "synthesis", id: s.id, label: s.statement.slice(0, 60) }],
      }));
    }
  }

  return out;
};
