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

import type { Session } from "@supabase/supabase-js";
import type { StoreState } from "@/types/mvp";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { SupabasePersistenceAdapter } from "@/lib/adapters/supabaseAdapter";
import type { PersistenceHealth } from "@/lib/adapters/types";
import * as authStore from "@/lib/authStore";

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
    feedback: partial?.feedback ?? [],
    comparisons: partial?.comparisons ?? [],
    inquiries: partial?.inquiries ?? [],
    megathreads: partial?.megathreads ?? [],
    reflections: partial?.reflections ?? [],
    practices: partial?.practices ?? [],
    reviews: partial?.reviews ?? [],
    reasonings: partial?.reasonings ?? [],
    embeddings: partial?.embeddings ?? [],
    decisions: partial?.decisions ?? [],
    formationSessions: partial?.formationSessions ?? [],
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

// ---------------- init + auth-driven remote enable/disable ----------------

let listenerSet = false;

/**
 * Called once client-side after local hydration. Configures the auth
 * listener (email identity only). Remote sync is enabled ONLY when a
 * durable, email-verified session exists — never for anonymous or
 * signed-out states. `replaceState` swaps the in-memory store to adopted
 * remote data.
 */
export async function initPersistence(
  replaceState: (s: StoreState) => void,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    authStore.setUnconfigured();
    setHealth({ mode: "local", state: "disabled" });
    return;
  }
  const client = getSupabaseClient();
  if (!client) {
    authStore.setUnconfigured();
    setHealth({ mode: "local", state: "disabled" });
    return;
  }
  authStore.setConfigured();

  if (listenerSet) return;
  listenerSet = true;
  // Fires INITIAL_SESSION immediately, then on every sign-in/out.
  client.auth.onAuthStateChange((_event, session) => {
    void handleSession(session, replaceState);
  });
}

async function handleSession(
  session: Session | null,
  replaceState: (s: StoreState) => void,
): Promise<void> {
  authStore.applySession(session);

  if (!session) {
    // Signed out (or never signed in): local-only. Keep local data.
    remote = null;
    setHealth({ mode: "local", state: "disabled" });
    return;
  }

  const client = getSupabaseClient();
  if (!client) return;
  remote = new SupabasePersistenceAdapter(client);
  setHealth({ mode: "supabase", state: "syncing" });
  try {
    await migrateOrAdopt(session.user.id, replaceState);
    setHealth({ state: "synced", error: undefined });
  } catch (e) {
    setHealth({ state: "failed", error: msg(e) });
  }
}

/**
 * Idempotent, wrong-user-safe reconciliation between local and remote:
 *  - remote has data              → adopt remote (source of truth)
 *  - remote empty, local unowned  → migrate local up (this user owns it now)
 *  - remote empty, local is ours  → re-push local (idempotent)
 *  - remote empty, local is someone else's → do NOT migrate; start clean for
 *    this user (their data is elsewhere; nothing is deleted from remote)
 */
async function migrateOrAdopt(
  userId: string,
  replaceState: (s: StoreState) => void,
): Promise<void> {
  if (!remote) return;
  const remoteState = await remote.loadState();
  const local = loadState();
  const migratedFor = readMigratedFor();

  if (hasData(remoteState)) {
    replaceState(normalize(remoteState));
    writeMigratedFor(userId);
    return;
  }
  if (!migratedFor || migratedFor === userId) {
    if (hasData(local)) await remote.saveState(normalize(local));
    writeMigratedFor(userId);
    return;
  }
  // Local data belongs to a different account — never migrate it into this one.
  replaceState(normalize(null));
  writeMigratedFor(userId);
}

function readMigratedFor(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(MIGRATED_KEY);
  } catch {
    return null;
  }
}
function writeMigratedFor(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MIGRATED_KEY, userId);
  } catch {
    // no-op
  }
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "unknown error";
}
