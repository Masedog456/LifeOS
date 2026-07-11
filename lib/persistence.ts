/**
 * The persistence boundary for LifeOS (LIFEOS-004).
 *
 * The store still calls loadState/saveState/clearState synchronously for an
 * instant, offline-first local write. When Supabase is configured AND the
 * user is authenticated, every local write also schedules a debounced
 * remote sync (write locally first, sync remotely second). The UI and store
 * never call Supabase directly — only this facade and the adapters do.
 *
 * Sync status ("Saved locally" / "Syncing" / "Synced" / "Sync failed") is
 * exposed as a small observable for an unobtrusive indicator.
 */

import type { StoreState } from "@/types/mvp";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { SupabasePersistenceAdapter } from "@/lib/adapters/supabaseAdapter";
import type { PersistenceHealth } from "@/lib/adapters/types";

const STORAGE_KEY = "lifeos.mvp.v1";
const MIGRATED_KEY = "lifeos.migrated.v1";

let remote: SupabasePersistenceAdapter | null = null;
let lastSaved: StoreState | null = null;

let health: PersistenceHealth = {
  mode: "local",
  state: isSupabaseConfigured() ? "syncing" : "disabled",
};
const listeners = new Set<() => void>();

export function subscribeHealth(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function getHealth(): PersistenceHealth {
  return health;
}
function setHealth(next: Partial<PersistenceHealth>): void {
  health = { ...health, ...next };
  listeners.forEach((l) => l());
}

function normalize(partial: Partial<StoreState> | null): StoreState {
  return {
    captures: partial?.captures ?? [],
    proposals: partial?.proposals ?? [],
    beliefs: partial?.beliefs ?? [],
    sources: partial?.sources ?? [],
  };
}

function hasData(s: Partial<StoreState> | null): boolean {
  return Boolean(
    s && ((s.sources?.length ?? 0) || (s.beliefs?.length ?? 0) || (s.captures?.length ?? 0) || (s.proposals?.length ?? 0)),
  );
}

// ---------------- local (synchronous) ----------------

export function loadState(): Partial<StoreState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<StoreState>) : null;
  } catch {
    return null;
  }
}

function writeLocal(state: StoreState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota/serialization errors in the prototype.
  }
}

/** Write locally now, and (if remote is active) schedule a debounced sync. */
export function saveState(state: StoreState): void {
  lastSaved = state;
  writeLocal(state);
  scheduleRemotePush(state);
}

/** Write locally only — used when adopting remote data, to avoid a re-push loop. */
export function saveLocalOnly(state: StoreState): void {
  lastSaved = state;
  writeLocal(state);
}

export function clearState(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(MIGRATED_KEY);
    } catch {
      // no-op
    }
  }
  lastSaved = null;
  if (remote) {
    setHealth({ state: "syncing" });
    remote
      .deleteAll()
      .then(() => setHealth({ state: "synced", error: undefined }))
      .catch((e) => setHealth({ state: "failed", error: msg(e) }));
  }
}

// ---------------- remote sync ----------------

let pending: StoreState | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

function scheduleRemotePush(state: StoreState): void {
  if (!remote) return;
  pending = state;
  setHealth({ mode: "supabase", state: "syncing" });
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), 400);
}

async function flush(): Promise<void> {
  if (!remote || !pending) return;
  const snapshot = pending;
  pending = null;
  try {
    await remote.saveState(snapshot);
    setHealth({ state: "synced", error: undefined });
  } catch (e) {
    setHealth({ state: "failed", error: msg(e) });
  }
}

/** Retry a failed sync by re-pushing the latest local state. */
export async function retrySync(): Promise<void> {
  if (!remote || !lastSaved) return;
  pending = lastSaved;
  setHealth({ state: "syncing" });
  await flush();
}

// ---------------- init + first-run migration ----------------

/**
 * Called once client-side after local hydration. Ensures auth, then either
 * adopts existing remote data or performs a one-time migration of local
 * data upward. Never deletes local data. `replaceState` swaps the in-memory
 * store to adopted remote data.
 */
export async function initRemote(replaceState: (s: StoreState) => void): Promise<void> {
  if (!isSupabaseConfigured()) {
    setHealth({ mode: "local", state: "disabled" });
    return;
  }
  const client = getSupabaseClient();
  if (!client) {
    setHealth({ mode: "local", state: "disabled" });
    return;
  }

  setHealth({ mode: "supabase", state: "syncing" });
  try {
    let {
      data: { session },
    } = await client.auth.getSession();
    if (!session) {
      const { error } = await client.auth.signInAnonymously();
      if (error) throw error;
      ({
        data: { session },
      } = await client.auth.getSession());
    }
    if (!session) throw new Error("no authenticated session");

    remote = new SupabasePersistenceAdapter(client);
    const userId = session.user.id;

    const remoteState = await remote.loadState();
    const local = loadState();
    const migratedFor =
      typeof window !== "undefined" ? window.localStorage.getItem(MIGRATED_KEY) : null;

    if (hasData(remoteState)) {
      // Remote is the source of truth once it has data.
      replaceState(normalize(remoteState));
    } else if (hasData(local) && migratedFor !== userId) {
      // One-time upward migration; keep local data intact until confirmed.
      await remote.saveState(normalize(local));
      if (typeof window !== "undefined") window.localStorage.setItem(MIGRATED_KEY, userId);
    }
    setHealth({ state: "synced", error: undefined });
  } catch (e) {
    // Remote unavailable → stay in local mode; nothing is lost.
    remote = null;
    setHealth({ mode: "supabase", state: "failed", error: msg(e) });
  }
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "unknown error";
}
