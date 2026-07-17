/**
 * Citation resolution (LIFEOS-019, Phase 6).
 *
 * Maps citation ids (real record ids) to human labels + provenance, and finds
 * unsupported statements across a project. Pure and offline.
 */

import type { CitationKind, KnowledgeProject, ProjectEvidence, StoreState } from "@/types/mvp";
import { assembleEvidence } from "@/lib/authoring/assembly";

export interface ResolvedCitation {
  id: string;
  kind: CitationKind;
  label: string;
  href?: string;
}

const HREF: Partial<Record<CitationKind, (id: string) => string>> = {
  source: (id: string) => `/library/${id}`,
  concept: (id: string) => `/world/concept/${id}`,
  thread: (id: string) => `/threads/${id}`,
  reasoning: (id: string) => `/reason/${id}`,
  decision: (id: string) => `/decisions/${id}`,
  formation: (id: string) => `/formation/${id}`,
};

/** Build an id → resolved-citation map for a project's assembled evidence. */
export function citationIndex(state: StoreState, project: KnowledgeProject): Map<string, ResolvedCitation> {
  const map = new Map<string, ResolvedCitation>();
  for (const e of assembleEvidence(state, project.assembly)) {
    map.set(e.id, { id: e.id, kind: e.kind, label: e.label, href: HREF[e.kind]?.(e.id) });
  }
  return map;
}

/** Every unsupported paragraph across the project, with its section. */
export function unsupportedAcrossProject(project: KnowledgeProject): { sectionId: string; heading: string; paragraphId: string; text: string }[] {
  const out: { sectionId: string; heading: string; paragraphId: string; text: string }[] = [];
  for (const s of project.sections) {
    for (const p of s.paragraphs) {
      if (p.citations.length === 0) out.push({ sectionId: s.id, heading: s.heading, paragraphId: p.id, text: p.text });
    }
  }
  return out;
}

/** Ordered, de-duplicated list of every distinct citation used in the work (for a reference list). */
export function usedCitations(state: StoreState, project: KnowledgeProject): ResolvedCitation[] {
  const index = citationIndex(state, project);
  const seen = new Set<string>();
  const out: ResolvedCitation[] = [];
  for (const s of project.sections) {
    for (const p of s.paragraphs) {
      for (const cid of p.citations) {
        if (seen.has(cid)) continue;
        seen.add(cid);
        const r = index.get(cid);
        if (r) out.push(r);
      }
    }
  }
  return out;
}

/** Coverage: how much of the assembled evidence is actually cited somewhere. */
export function citationCoverage(state: StoreState, project: KnowledgeProject): { used: number; assembled: number; evidence: ProjectEvidence[] } {
  const evidence = assembleEvidence(state, project.assembly);
  const usedIds = new Set(usedCitations(state, project).map((c) => c.id));
  return { used: usedIds.size, assembled: evidence.length, evidence };
}
