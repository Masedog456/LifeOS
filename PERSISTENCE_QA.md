# LIFEOS-004 — Persistence & Real-AI QA

> Two modes exist. **Local mode** (no Supabase env vars) is the default and
> is fully verified. **Supabase mode** (both `NEXT_PUBLIC_SUPABASE_*` vars
> set) is implemented but must be verified by you after the manual setup
> below, since it needs live credentials.

## Manual setup (do this once, in order)

### 1. Supabase database
1. In your `lifeos` Supabase project, open **SQL Editor** and run
   `supabase/migrations/0001_initial_schema.sql` (paste and execute).
2. **Project Settings → API**: copy the **Project URL** and the **anon
   public** key. (Never copy the **service-role** key into this project.)

### 1b. Supabase authentication (email magic link)
LifeOS signs in with a durable **email** identity — remote sync only starts
after a permanent account exists. Configure:

1. **Authentication → Providers → Email**: enabled (on by default). The
   default "Magic Link" flow is what LifeOS uses (`signInWithOtp`). No
   password is required.
2. **Authentication → Providers → Anonymous**: **leave DISABLED.** LifeOS
   deliberately does not use anonymous auth for sync — pre-sign-in usage is
   local-only. Enabling it is unnecessary and not recommended.
3. **Authentication → URL Configuration**:
   - **Site URL**: your production URL (e.g. `https://lifeos.vercel.app`).
   - **Redirect URLs** (add both): `http://localhost:3000/**` and
     `https://<your-vercel-domain>/**`. The magic link redirects back to the
     app's origin; these must be allowlisted or sign-in will fail.
4. (Optional) **Authentication → Email Templates → Magic Link**: customize
   wording. The default works.

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

## B. Authentication + sync (run after setup — CREDENTIAL-DEPENDENT, pending)

- [ ] Configured but **signed out** → indicator shows **"Saved locally"**,
      a **"Sign in"** control appears, and NOTHING syncs remotely yet
      (Supabase tables stay empty).
- [ ] Click **Sign in**, enter email → "Check your email" → click the magic
      link → you return signed in; the email shows in the nav.
- [ ] On first sign-in, existing local data **migrates once** to your
      account (rows appear in `sources`/`beliefs`), and local data is **not**
      deleted. Indicator goes **Syncing… → Synced**.
- [ ] Reload → no duplicate rows (migration is one-time; upserts idempotent).
- [ ] Add a source / accept a belief while signed in → row appears in
      Supabase; indicator shows **Synced**.
- [ ] **Sign out** → back to local-only ("Saved locally"); local data
      remains usable.
- [ ] Belief revisions/judgments are **append-only** in `belief_revisions` /
      `user_judgments` (new `seq` rows only; none updated/deleted).
- [ ] `original_text`, capture `text`, and `saved_quotes.text` cannot be
      overwritten (DB triggers / append-only RLS reject it).
- [ ] Row-level security: a second account cannot read the first's rows.

## B2. Cross-device (CREDENTIAL-DEPENDENT, pending)

- [ ] Browser A: sign in, create a source and a belief.
- [ ] Browser B (or another device): sign in with the **same email**.
- [ ] Browser B loads the same Library, Inbox, Constitution, quotes,
      revisions, and judgments.
- [ ] No wrong-user migration: if a different email signs in on a browser
      that already held another account's data, that data is **not** pushed
      into the new account (it stays in its owner's account).

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
- Supabase + email-auth mode is code-complete but **unverified in this
  environment** (no credentials were available); local mode is fully
  verified.
- Sync is whole-state debounced upsert (fine for single-user volume), not
  real-time collaboration.
- Identity is **email magic link only** (durable, cross-device). Anonymous
  auth is intentionally not used for sync; pre-sign-in usage is local-only.
- If you edit data locally while signed out on a device whose account
  already has remote data, then sign in, the remote copy is adopted as the
  source of truth (those particular offline edits are not merged). Append-
  only history is never lost. Sign in before editing to avoid this.
