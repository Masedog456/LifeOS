/**
 * Deterministic data-integrity checks (LIFEOS-025).
 *
 * Read-only by default: every check inspects the store and reports findings
 * with human-readable remediation guidance — nothing is deleted or rewritten.
 * The single offered repair (dropping recommendations that point at missing
 * records) is safe and effectively reversible: recommendations are DERIVED
 * opportunities, and re-running the orchestrator scan recreates any whose
 * signal still exists. User knowledge is never touched.
 */

import type { StoreState } from "@/types/mvp";
import { buildGraph, graphIntegrity } from "@/lib/graph";

export type IntegritySeverity = "ok" | "info" | "warning" | "problem";

export interface IntegrityFinding {
  id: string;
  check: string;
  severity: IntegritySeverity;
  message: string;
  remediation: string;
  /** Affected record ids (references — never copies). */
  refs: string[];
}

const VALID = {
  beliefStatus: new Set(["accepted", "questioned", "revised", "rejected"]),
  dialogueStatus: new Set(["open", "active", "paused", "concluded", "archived"]),
  tensionStatus: new Set(["open", "under_synthesis", "resolved", "dissolved", "accepted_as_paradox"]),
  synthesisStatus: new Set(["candidate", "accepted", "rejected", "superseded"]),
  decisionStatus: new Set(["exploring", "narrowed", "decided", "deferred", "abandoned"]),
  conceptStatus: new Set(["proposed", "active", "archived", "merged"]),
  practiceStatus: new Set(["proposed", "accepted", "paused", "completed", "rejected"]),
  confidenceLevel: new Set(["unknown", "low", "moderate", "high"]),
  recPriority: new Set(["low", "medium", "high"]),
};

function allRecordIds(state: StoreState): Set<string> {
  const ids = new Set<string>();
  const add = (arr: { id: string }[]) => { for (const r of arr) ids.add(r.id); };
  add(state.captures); add(state.proposals); add(state.beliefs); add(state.sources);
  add(state.comparisons); add(state.inquiries); add(state.megathreads); add(state.reflections);
  add(state.practices); add(state.reviews); add(state.reasonings); add(state.decisions);
  add(state.formationSessions); add(state.concepts); add(state.conceptRelationships);
  add(state.principles); add(state.frameworks); add(state.knowledgeProjects);
  add(state.researchProjects); add(state.dialogueSessions); add(state.tensions); add(state.syntheses);
  return ids;
}

function nonDecreasing(times: string[]): boolean {
  for (let i = 1; i < times.length; i++) {
    const a = Date.parse(times[i - 1]), b = Date.parse(times[i]);
    if (!Number.isNaN(a) && !Number.isNaN(b) && b < a) return false;
  }
  return true;
}

function validConfidence(c: unknown): boolean {
  if (!c || typeof c !== "object") return false;
  const o = c as Record<string, unknown>;
  return ["factual", "logical", "evidential", "experiential"].every(
    (ax) => typeof o[ax] === "string" && VALID.confidenceLevel.has(o[ax] as string),
  );
}

/** Run every integrity check. Pure and deterministic — the store is never mutated. */
export function runIntegrityChecks(state: StoreState): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  let n = 0;
  const finding = (check: string, severity: IntegritySeverity, message: string, remediation: string, refs: string[] = []) =>
    out.push({ id: `f${++n}`, check, severity, message, remediation, refs });

  // 1. Missing referenced records — explicit stored ids that resolve to nothing.
  const g = buildGraph(state);
  const gi = graphIntegrity(state, g);
  if (gi.brokenReferences.length > 0) {
    finding("missing_referenced_records", "warning",
      `${gi.brokenReferences.length} stored reference(s) point at records that no longer exist.`,
      "Open the referencing record and remove or replace the dangling reference; or re-import the missing source.",
      gi.brokenReferences.map((e) => e.from).slice(0, 20));
  } else {
    finding("missing_referenced_records", "ok", "Every stored reference resolves to a real record.", "No action needed.");
  }

  // 2. Duplicate stable signatures (tensions + recommendations must be unique per signature).
  const dupSigs: string[] = [];
  for (const [name, arr] of [["tension", state.tensions], ["recommendation", state.recommendations]] as const) {
    const seen = new Map<string, string>();
    for (const r of arr) {
      if (!r.signature) continue;
      if (seen.has(r.signature)) dupSigs.push(`${name}:${r.id}`);
      else seen.set(r.signature, r.id);
    }
  }
  finding("duplicate_signatures", dupSigs.length ? "warning" : "ok",
    dupSigs.length ? `${dupSigs.length} record(s) share a dedupe signature with another record.` : "All dedupe signatures are unique.",
    dupSigs.length ? "Remove the duplicate (keep the one with the history you care about). Detection will not re-create a duplicate." : "No action needed.",
    dupSigs.map((s) => s.split(":")[1]));

  // 3. Invalid status values.
  const badStatus: string[] = [];
  for (const b of state.beliefs) if (!VALID.beliefStatus.has(b.status)) badStatus.push(b.id);
  for (const d of state.dialogueSessions) if (!VALID.dialogueStatus.has(d.status)) badStatus.push(d.id);
  for (const t of state.tensions) if (!VALID.tensionStatus.has(t.status)) badStatus.push(t.id);
  for (const s of state.syntheses) if (!VALID.synthesisStatus.has(s.status)) badStatus.push(s.id);
  for (const d of state.decisions) if (!VALID.decisionStatus.has(d.status)) badStatus.push(d.id);
  for (const c of state.concepts) if (!VALID.conceptStatus.has(c.status)) badStatus.push(c.id);
  for (const p of state.practices) if (!VALID.practiceStatus.has(p.status)) badStatus.push(p.id);
  finding("invalid_status_values", badStatus.length ? "problem" : "ok",
    badStatus.length ? `${badStatus.length} record(s) carry a status outside their allowed set.` : "Every record's status is a recognised value.",
    badStatus.length ? "Open the record and set a valid status; an unknown status usually comes from hand-edited data." : "No action needed.",
    badStatus);

  // 4. Malformed confidence structures (four independent axes, each a valid level).
  const badConf: string[] = [];
  for (const t of state.tensions) if (!validConfidence(t.confidence)) badConf.push(t.id);
  for (const s of state.syntheses) {
    if (!validConfidence(s.confidence)) badConf.push(s.id);
    for (const r of s.revisions) if (!validConfidence(r.confidence)) badConf.push(s.id);
  }
  for (const r of state.recommendations) if (!VALID.confidenceLevel.has(r.confidence)) badConf.push(r.id);
  finding("malformed_confidence", badConf.length ? "warning" : "ok",
    badConf.length ? `${badConf.length} record(s) have a confidence structure missing an axis or using an unknown level.` : "Every confidence structure is well-formed (four axes, valid levels).",
    badConf.length ? "Re-save the record from its workspace (revise the synthesis / update the tension) to rebuild a valid confidence structure." : "No action needed.",
    [...new Set(badConf)]);

  // 5. Orphaned graph references — records with no edges at all (informational, not a defect).
  finding("orphaned_graph_records", gi.orphanRecords.length ? "info" : "ok",
    gi.orphanRecords.length ? `${gi.orphanRecords.length} record(s) have no connections in the knowledge graph.` : "Every record participates in at least one relationship.",
    gi.orphanRecords.length ? "Not necessarily wrong — but linking these records (to beliefs, concepts, or projects) makes them reachable by the graph, retrieval, and the orchestrator." : "No action needed.",
    gi.orphanRecords.map((r) => r.id).slice(0, 20));

  // 6. Syntheses without valid tensions.
  const tensionIds = new Set(state.tensions.map((t) => t.id));
  const orphanSyntheses = state.syntheses.filter((s) => s.tensionIds.length === 0 || s.tensionIds.some((id) => !tensionIds.has(id)));
  finding("syntheses_without_tensions", orphanSyntheses.length ? "warning" : "ok",
    orphanSyntheses.length ? `${orphanSyntheses.length} synthesis(es) reference a tension that no longer exists.` : "Every synthesis is anchored to existing tensions.",
    orphanSyntheses.length ? "Open the dialogue's Dialectic tab and either remove the synthesis or re-detect the tension it belonged to." : "No action needed.",
    orphanSyntheses.map((s) => s.id));

  // 7. Tensions without valid dialogue sessions.
  const dialogueIds = new Set(state.dialogueSessions.map((d) => d.id));
  const orphanTensions = state.tensions.filter((t) => !dialogueIds.has(t.dialogueId));
  finding("tensions_without_dialogues", orphanTensions.length ? "warning" : "ok",
    orphanTensions.length ? `${orphanTensions.length} tension(s) belong to a dialogue that no longer exists.` : "Every tension belongs to an existing dialogue.",
    orphanTensions.length ? "Recreate the dialogue, or remove the tension from the Dialectic workspace of any dialogue that still covers the topic." : "No action needed.",
    orphanTensions.map((t) => t.id));

  // 8. Recommendations pointing at missing records (repairable — see repairStaleRecommendations).
  const known = allRecordIds(state);
  const staleRecs = state.recommendations.filter((r) => r.affected.some((a) => a.id && !known.has(a.id)));
  finding("recommendations_missing_records", staleRecs.length ? "warning" : "ok",
    staleRecs.length ? `${staleRecs.length} recommendation(s) point at records that no longer exist.` : "Every recommendation points at existing records.",
    staleRecs.length ? "Safe repair available: remove these recommendations. They are derived — re-running the scan recreates any whose signal still exists." : "No action needed.",
    staleRecs.map((r) => r.id));

  // 9. Revision histories with invalid ordering (append-only must be chronological).
  const badHistories: string[] = [];
  for (const b of state.beliefs) if (!nonDecreasing(b.revisions.map((r) => r.at))) badHistories.push(b.id);
  for (const s of state.syntheses) if (!nonDecreasing(s.revisions.map((r) => r.at))) badHistories.push(s.id);
  finding("revision_ordering", badHistories.length ? "warning" : "ok",
    badHistories.length ? `${badHistories.length} record(s) have a revision history that is not in chronological order.` : "Every revision history is chronological.",
    badHistories.length ? "Usually caused by clock changes or hand-edited data. The history is still intact; no repair is required, but be aware when reading it." : "No action needed.",
    badHistories);

  // 10. Records missing user ownership — local records deliberately carry no user id;
  // ownership is enforced server-side by RLS (`user_id default auth.uid()` on every table).
  finding("user_ownership", "info",
    "Local records carry no ownership field by design (single-user, local-first). Remote rows are owned via RLS defaults on every table.",
    "Nothing to do locally. When signed in, every synced row is stamped with your user id by the database itself.");

  return out;
}

/** Overall severity for a set of findings (worst wins). */
export function integritySummary(findings: IntegrityFinding[]): IntegritySeverity {
  if (findings.some((f) => f.severity === "problem")) return "problem";
  if (findings.some((f) => f.severity === "warning")) return "warning";
  if (findings.some((f) => f.severity === "info")) return "info";
  return "ok";
}
