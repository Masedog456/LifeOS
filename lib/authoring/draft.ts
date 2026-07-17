/**
 * Section drafting orchestrator (LIFEOS-019, Phase 5).
 *
 * Drafts ONE section at a time on explicit request — never the whole work. The
 * assembled evidence is the only material; a single `section_draft` AI call
 * produces cited paragraphs, validated so citations point at real records.
 * Transforms (rewrite/expand/compress/clarify + academic/popular/technical/
 * conversational) re-draft the same section in a new register. Mock offline.
 */

import type { DraftSection, DraftTransform, KnowledgeProject, StoreState } from "@/types/mvp";
import { assembleEvidence } from "@/lib/authoring/assembly";
import { validateSectionDraft } from "@/lib/authoring/schema";
import { draftSection } from "@/lib/aiClient";
import { projectDeps } from "@/lib/freshness/fingerprint";
import { makeFingerprint } from "@/lib/freshness/fingerprint";

export const TRANSFORMS: DraftTransform[] = [
  "rewrite", "expand", "compress", "clarify",
  "academic", "popular", "technical", "conversational",
];

export function estimateDraft(state: StoreState, project: KnowledgeProject) {
  return { calls: 1, evidenceCount: assembleEvidence(state, project.assembly).length };
}

/**
 * Draft (or re-draft) one section. Returns the new paragraphs + provenance; the
 * caller pushes the prior version into append-only history and never discards
 * the user's earlier text.
 */
export async function runSectionDraft(
  state: StoreState,
  project: KnowledgeProject,
  section: DraftSection,
  transform?: DraftTransform,
): Promise<{ paragraphs: DraftSection["paragraphs"]; source: "ai" | "mock"; unsupported: number; fingerprint: DraftSection["fingerprint"] }> {
  const evidence = assembleEvidence(state, project.assembly);
  const valid = new Set(evidence.map((e) => e.id));

  const { result: raw, source } = await draftSection({
    evidence,
    heading: section.heading,
    purpose: section.purpose ?? "",
    transform,
    existing: transform ? section.paragraphs.map((p) => p.text).join("\n\n") : "",
  });

  const { paragraphs, unsupported } = validateSectionDraft(raw, valid);
  const fingerprint = makeFingerprint(state, projectDeps(project));
  return { paragraphs, source, unsupported, fingerprint };
}
