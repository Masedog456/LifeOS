/**
 * Shared graph-store facade (LIFEOS-021, Phase 6): the unified relationship API
 * and performance layer. This is the cross-domain query surface every module
 * shares instead of re-deriving reverse lookups.
 */

export {
  buildGraph, lookup, forwardReferences, backReferences, relationshipsOf,
  dependencyChain, provenance, parents, children, graphIntegrity,
} from "@/lib/graph";
export { buildGraphEdges, categorize } from "@/lib/graph/references";
export type { GraphEdge, GraphNode, BackReferences, RecordKind, RefRelation, KnowledgeGraph, GraphIntegrity } from "@/lib/graph";
export { measureStore, recordCounts, storeBytes, profile } from "@/lib/perf/profile";
