/**
 * Domain store facades (LIFEOS-021, Phase 6).
 *
 * The store is still ONE module-level reactive store (`lib/mvpStore.ts`) —
 * physically splitting it would touch every page import and risk the whole
 * regression suite, which the sprint explicitly forbids ("avoid breaking
 * changes"). Instead these facades give a MODULAR API surface: each domain
 * re-exports its own selectors/actions, so callers can depend on a narrow
 * domain module (`@/lib/stores/knowledge`) rather than the monolith, and the
 * StoreState is organized into named domains without a rewrite.
 *
 * `useStore()` and `getStoreSnapshot()` remain the single source of state.
 */

export * as knowledge from "@/lib/stores/knowledge";
export * as research from "@/lib/stores/research";
export * as author from "@/lib/stores/author";
export * as world from "@/lib/stores/world";
export * as reasoning from "@/lib/stores/reasoning";
export * as decision from "@/lib/stores/decision";
export * as graph from "@/lib/stores/graph";

export { useStore, getStoreSnapshot } from "@/lib/mvpStore";
