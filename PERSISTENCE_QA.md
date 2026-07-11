# LIFEOS-004 — Persistence & Real-AI QA

> Two modes exist. **Local mode** (no Supabase env vars) is the default and
> is fully verified. **Supabase mode** (both `NEXT_PUBLIC_SUPABASE_*` vars
> set) is implemented but must be verified by you after the manual setup
> below, since it needs live credentials.

## Manual setup (do this once, in order)

### 1. Supabase
1. In your `lifeos` Supabase project, open **SQL Editor** and run
   `supabase/migrations/0001_initial_schema.sql` (paste and execute).
2. **Authentication → Providers → Anonymous**: enable "Allow anonymous
   sign-ins". (Email auth also works and needs no code change.)
3. **Project Settings → API**: copy the **Project URL** and the **anon
   public** key.

### 2. Local `.env.local` (never committed)
```
NEXT_PUBLIC_SUPABASE_URL=<your Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon public key>
ANTHROPIC_API_KEY=<your Anthropic key>     # server-only; blank = mock
ANTHROPIC_MODEL=claude-sonnet-5            # optional
```

### 3. Vercel (Production + Preview scopes)
Add the same four variables in **Project → Settings → Environment
Variables**. `NEXT_PUBLIC_*` are exposed to the browser (safe);
`ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` are server-only — do **not**
prefix them with `NEXT_PUBLIC_`. Never paste the Supabase **service-role**
key anywhere in this project.

---

## A. Local mode (verified — no credentials needed)

- [x] Sync indicator reads **"Saved locally"** when Supabase is unset.
- [x] Add manual-text source → pipeline → summary/quotes/concepts/candidate beliefs.
- [x] Save a quote in the reader.
- [x] Send a belief candidate to the Inbox.
- [x] Rewrite/accept it in the Inbox.
- [x] It appears in the Constitution.
- [x] The reader shows "Beliefs from this source".
- [x] Refresh the browser → all data remains (localStorage).
- [x] `/api/ai` invalid task → HTTP 400; invalid JSON → HTTP 400.
- [x] `/api/ai` with no key → deterministic mock (`"source":"mock"`).
- [x] `npm run lint` = 0, `npm run build` = 0.
- [x] No secret **value** in the client bundle (only the identifier string
      "ANTHROPIC_API_KEY" inside a user-facing mock hint — not the key).

## B. Supabase mode (run after setup above)

- [ ] With env set, load the app: indicator goes **Syncing… → Synced**.
- [ ] Existing local data is **migrated once** to Supabase on first load
      (check the `beliefs`/`sources` tables in Supabase). Local data is
      **not** deleted.
- [ ] Reloading does not duplicate rows (migration is one-time, upserts are
      idempotent).
- [ ] Add a source / accept a belief → row appears in Supabase; indicator
      shows **Synced**.
- [ ] Open the app in a **second browser** (same login path): the same data
      loads from Supabase.
- [ ] Belief revisions and judgments are **append-only** in
      `belief_revisions` / `user_judgments` (no rows are updated/deleted;
      new `seq` rows are added).
- [ ] `original_text`, capture `text`, and `saved_quotes.text` cannot be
      overwritten (DB triggers / append-only RLS reject it).
- [ ] Row-level security: a second user cannot read the first user's rows
      (test with two anonymous sessions if desired).

## C. Real Anthropic (run after key is set)

- [ ] Add a source → summary/quotes/concepts/beliefs come back with
      `"source":"ai"` (not `"mock"`).
- [ ] Ask a question in the reader → a real answer (not the mock hint).
- [ ] Quote spans still resolve (candidate beliefs highlight correctly).
- [ ] Kill network / use a bad key → route degrades to mock
      (`"source":"mock"`, `"degraded":true`); the app keeps working.

## D. Failure resilience

- [ ] Simulate remote failure (wrong URL, or offline): writes still succeed
      locally ("Saved locally"/"Sync failed" with a **Retry** action);
      nothing is lost. Fix connectivity → **Retry** re-syncs.

---

## Known limitations
- Supabase mode is code-complete but **unverified in this environment**
  (no credentials were available); local mode is fully verified.
- Sync is whole-state debounced upsert (fine for single-user volume), not
  real-time collaboration.
- Anonymous auth ties data to the browser's anonymous identity; clearing
  the browser's Supabase session starts a new anonymous user. For durable
  cross-device identity, enable email auth (no code change required).
