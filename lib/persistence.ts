/**
 * The storage boundary for LifeOS.
 *
 * This is the ONE place the app touches its persistence backend. Today it
 * is browser localStorage. To move to Supabase later, reimplement these
 * three functions (likely making them async and swapping the store's
 * hydrate/persist to await them) — nothing else in the app needs to know
 * where state lives. Keeping this seam thin is deliberate: it is the
 * "architect so replacing local storage requires minimal changes"
 * requirement made concrete.
 */

import type { StoreState } from "@/types/mvp";

const STORAGE_KEY = "lifeos.mvp.v1";

export function loadState(): Partial<StoreState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<StoreState>) : null;
  } catch {
    return null;
  }
}

export function saveState(state: StoreState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota/serialization errors in the prototype.
  }
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}
