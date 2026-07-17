/**
 * Deterministic profiling utilities (LIFEOS-021, Phase 5).
 *
 * Measures the things that matter as the store grows — hydration, store size,
 * graph build/lookup, timeline generation, and assembly — using a monotonic
 * clock. Pure measurement: it never changes behavior, calls no AI, and returns
 * plain numbers a diagnostics view can render.
 */

import type { StoreState } from "@/types/mvp";
import { buildGraph, graphIntegrity } from "@/lib/graph";
import { buildFormationTimeline } from "@/lib/formation/timeline";
import { assembleEvidence } from "@/lib/authoring/assembly";

function nowMs(): number {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

/** Time a synchronous function; returns its result plus elapsed milliseconds. */
export function profile<T>(fn: () => T): { result: T; ms: number } {
  const start = nowMs();
  const result = fn();
  return { result, ms: Math.round((nowMs() - start) * 1000) / 1000 };
}

/** Per-domain record counts across the whole store. */
export function recordCounts(state: StoreState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(state)) out[k] = Array.isArray(v) ? v.length : 0;
  return out;
}

/** Approximate serialized byte size of the store (and per domain). */
export function storeBytes(state: StoreState): { total: number; byDomain: Record<string, number> } {
  const byDomain: Record<string, number> = {};
  let total = 0;
  for (const [k, v] of Object.entries(state)) {
    const n = new TextEncoder().encode(JSON.stringify(v ?? [])).length;
    byDomain[k] = n;
    total += n;
  }
  return { total, byDomain };
}

export interface PerfReport {
  totalRecords: number;
  counts: Record<string, number>;
  bytes: { total: number; byDomain: Record<string, number> };
  timings: {
    graphBuildMs: number;
    graphLookupMs: number;
    integrityMs: number;
    timelineMs: number;
    authoringAssemblyMs: number;
    researchAssemblyMs: number;
    serializeMs: number;
  };
  graph: { nodes: number; edges: number };
}

/** A full, deterministic performance snapshot for the diagnostics page. */
export function measureStore(state: StoreState): PerfReport {
  const counts = recordCounts(state);
  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

  const graphBuild = profile(() => buildGraph(state));
  const graph = graphBuild.result;

  // Lookup timing: resolve every node once.
  const lookup = profile(() => {
    let hits = 0;
    for (const id of graph.nodes.keys()) if (graph.nodes.get(id)) hits++;
    return hits;
  });

  const integrity = profile(() => graphIntegrity(state, graph));
  const timeline = profile(() => buildFormationTimeline(state));
  const authoring = profile(() => (state.knowledgeProjects[0] ? assembleEvidence(state, state.knowledgeProjects[0].assembly) : []));
  const research = profile(() => (state.researchProjects[0] ? assembleEvidence(state, state.researchProjects[0].assembly) : []));
  const serialize = profile(() => JSON.stringify(state).length);

  return {
    totalRecords,
    counts,
    bytes: storeBytes(state),
    timings: {
      graphBuildMs: graphBuild.ms,
      graphLookupMs: lookup.ms,
      integrityMs: integrity.ms,
      timelineMs: timeline.ms,
      authoringAssemblyMs: authoring.ms,
      researchAssemblyMs: research.ms,
      serializeMs: serialize.ms,
    },
    graph: { nodes: graph.nodes.size, edges: graph.edges.length },
  };
}
