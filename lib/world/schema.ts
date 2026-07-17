/**
 * World-model proposal validation (LIFEOS-018, Phase 4).
 *
 * The AI proposes new concepts, missing links, duplicates, missing
 * definitions, possible principles, and worldview clusters. Every proposal is
 * kept for HUMAN review — this validator only bounds shapes, clamps types, and
 * filters citations to real record ids (uncited claims are marked, not
 * silently trusted). Nothing here creates a concept; approval happens in the UI.
 */

import type {
  ConceptRelationshipType,
  WorldProposal,
  WorldProposalKind,
} from "@/types/mvp";
import { RELATIONSHIP_TYPES } from "@/lib/world/relationships";

const KINDS: WorldProposalKind[] = [
  "new_concept", "missing_link", "duplicate_concept",
  "missing_definition", "possible_principle", "worldview_cluster",
];

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function strArr(v: unknown, n = 10): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()).slice(0, n)
    : [];
}
function ids(v: unknown, valid: Set<string>): string[] {
  return Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => x.trim()))].filter((x) => valid.has(x))
    : [];
}

export function validateWorldProposals(raw: unknown, valid: Set<string>): { proposals: WorldProposal[]; flagged: string[] } {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const arr = Array.isArray(obj.proposals) ? obj.proposals : Array.isArray(raw) ? (raw as unknown[]) : [];
  const flagged: string[] = [];
  const proposals: WorldProposal[] = [];

  for (const p of arr.slice(0, 40)) {
    const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    const kind = str(o.kind) as WorldProposalKind;
    const statement = str(o.statement);
    if (!KINDS.includes(kind) || !statement) continue;

    const concepts = strArr(o.concepts, 6);
    const citations = ids(o.citations, valid);
    let relationshipType: ConceptRelationshipType | undefined;
    if (kind === "missing_link") {
      const rt = str(o.relationshipType) as ConceptRelationshipType;
      relationshipType = RELATIONSHIP_TYPES.includes(rt) ? rt : "related" as ConceptRelationshipType;
      if (!RELATIONSHIP_TYPES.includes(rt)) relationshipType = "supports"; // safe default; user re-picks on approve
    }
    // A grounded link/duplicate that cites nothing is worth flagging (still reviewable).
    if ((kind === "missing_link" || kind === "duplicate_concept") && citations.length === 0) {
      flagged.push(`Ungrounded ${kind.replace("_", " ")} (cites no record): "${statement.slice(0, 100)}"`);
    }

    proposals.push({
      kind,
      statement,
      concepts,
      relationshipType,
      suggestion: str(o.suggestion) || undefined,
      citations,
    });
  }

  return { proposals, flagged };
}
