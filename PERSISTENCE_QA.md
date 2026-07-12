# LIFEOS-004 — Persistence & Real-AI QA

> Two modes exist. **Local mode** (no Supabase env vars) is the default and
> is fully verified. **Supabase mode** (both `NEXT_PUBLIC_SUPABASE_*` vars
> set) is implemented but must be verified by you after the manual setup
> below, since it needs live credentials.

## Manual setup (do this once, in order)

### 1. Supabase database
1. In your `lifeos` Supabase project, open **SQL Editor** and run
   `supabase/migrations/0001_initial_schema.sql` (paste and execute).
2. Then run `supabase/migrations/0002_long_source_analysis.sql` (LIFEOS-007
   — adds `chunk_results` / `analysis` / `stages` jsonb columns to
   `sources`). It is additive and rerunnable (`add column if not exists`);
   it does not touch existing rows, other tables, RLS, or triggers.
3. Then run `supabase/migrations/0003_pdf_ingestion.sql` (LIFEOS-008 — adds
   `pdf_meta` / `page_map` / `extraction_status` to `sources`). Also
   additive/rerunnable. **No Supabase Storage bucket is needed:** PDF text
   is extracted client-side and only the text + metadata are stored; the PDF
   binary is never uploaded.
4. Then run `supabase/migrations/0004_retrieval.sql` (LIFEOS-009 — adds the
   append-only `retrieval_feedback` table with its own RLS: own-rows-only
   select + insert, no update/delete). Additive and rerunnable
   (`create table if not exists`, guarded policy creation); it does not
   touch migrations 0001–0003, existing rows, other tables, or their RLS.
   Retrieval itself is deterministic and in-memory — this table stores
   **only** the user's relevance feedback, never source text or beliefs.
5. Then run `supabase/migrations/0005_comparative_intelligence.sql`
   (LIFEOS-010 — adds the `comparisons` table: one row per saved comparison
   with jsonb `inputs`/`evidence`/`result`/`judgments`, own-rows RLS with
   full CRUD so append-only judgments can be added to the jsonb array).
   Additive and rerunnable; it does not touch migrations 0001–0004, existing
   rows, other tables, or their RLS. Comparison itself sends only a small,
   capped evidence packet to the AI route — never whole sources.
6. Then run `supabase/migrations/0006_dialectical_intelligence.sql`
   (LIFEOS-011 — adds the `inquiries` table: one row per saved dialectical
   inquiry with jsonb `inputs`/`evidence`/`result`/`history`/`judgments`,
   own-rows RLS with full CRUD so append-only history/judgments and the user's
   provisional conclusion can be added to an existing row). Additive and
   rerunnable; it does not touch migrations 0001–0005, existing rows, other
   tables, or their RLS. Inquiry sends only a small, capped evidence packet to
   the AI route — never whole sources.
7. Then run `supabase/migrations/0007_megathreads.sql` (LIFEOS-012 — adds the
   `megathreads` table: one row per thread with jsonb `members`/`pinned`/
   `excluded`/`synthesis`/`unresolved_questions`/`judgments`/`revisions`,
   own-rows RLS with full CRUD so curation + append-only judgments/revisions
   can be added to an existing row). Additive and rerunnable; it does not
   touch migrations 0001–0006, existing rows, other tables, or their RLS.
   Threads store only references to existing records — never copies of source
   text — and the timeline is a read-model derived at render time.
8. Then run `supabase/migrations/0008_formation_engine.sql` (LIFEOS-013 —
   adds `reflections` (immutable `response` enforced by a trigger + separate
   append-only `annotations`), `practices` (status machine + append-only
   `history`), and `review_sessions` (daily/weekly, jsonb surfaced items /
   judgments / optional synthesis). Own-rows RLS; reflections allow
   select/insert/update (update only for adding annotations — the trigger
   blocks changing `response`). Additive and rerunnable; it does not touch
   migrations 0001–0007, existing rows, other tables, or their RLS. There is
   **no** habit-tracker / streak / schedule table.
9. **Project Settings → API**: copy the **Project URL** and the **anon
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

> **Build-time gotcha:** `NEXT_PUBLIC_*` values are inlined into the client
> bundle **at build time**. They must be present in Vercel's env for the
> environment being built (Production and/or Preview) **before** the build
> runs, or the browser will see them as undefined and stay in local-only
> mode. After adding/changing them, trigger a fresh deployment.

### 4. Deployment branch (LIFEOS-005)
All LifeOS work to date is on `claude/lifeos-implementation-xwrikz`. Vercel
builds its **Production** environment from the project's **Production
Branch** (default: `main`). Choose one:
- **Recommended:** merge this branch into `main` and let Vercel deploy
  Production from `main`. Pushes to the feature branch then produce Preview
  deployments (using Preview-scoped env vars).
- **Or:** set **Vercel → Settings → Git → Production Branch** to
  `claude/lifeos-implementation-xwrikz`.

Vercel auto-detects **Next.js** — no `vercel.json` is needed. Defaults are
correct: Framework = Next.js, Build = `next build`, Install = `npm install`,
Output = `.next`. The app builds cleanly with **no** env vars set (it falls
back to local mode), so a misconfigured env never breaks the build — it only
changes runtime behavior.

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
- [x] **Comparison (LIFEOS-010):** compare 2 sources → structured result;
      agreements/disagreements cite exact evidence chips; shared concepts
      shown; partial-coverage sources labeled; an insight → Belief Inbox
      (proposal + capture created, Constitution unchanged); unsupported AI
      claims (bad evidence ids) dropped from conclusions + flagged; saved
      comparison persists after refresh; 5-source select cap + 6th disabled;
      belief-vs-sources runs. (15/15 automated checks, mock mode.)
- [x] **Inquiry (LIFEOS-011):** investigate a question with 2 sources →
      structured dialectic; affirmative/negative cases + counterarguments cite
      exact evidence chips; terminology disputes preserved; challenge a belief
      (relation-to-beliefs shown); accept an insight → Belief Inbox (proposal +
      capture, Constitution unchanged); save a provisional conclusion + status;
      unsupported AI assertions dropped from conclusions + flagged; evolve with
      an added source → prior result kept in append-only history + conclusion
      preserved; 5-source cap + verification confirm; persistence after refresh.
      (22/22 automated checks, mock mode.)
- [x] **Megathreads (LIFEOS-012):** seed a thread from a belief / comparison /
      inquiry (auto-members include the seed + its direct inputs); candidate
      membership is deterministic + explainable; include/exclude items;
      timeline is chronological with page/source provenance and shows belief
      evolution; comparisons/inquiries appear in context; generate a synthesis
      that cites valid evidence chips; unsupported synthesis points dropped +
      flagged; accept an insight → Belief Inbox (Constitution unchanged);
      thread + synthesis persist after refresh. (21/21 automated checks, mock
      mode.)
- [x] **Formation engine (LIFEOS-013):** daily review shows ≤3 items, each with
      an explicit reason; reflection saves without changing beliefs (response
      immutable); a "revise" enters the existing revision flow (append-only);
      practice candidates cite their derivation and require explicit
      acceptance (no auto-accept); dismissed/snoozed items don't immediately
      return; weekly counts reflect real activity and the optional synthesis
      cites valid record ids; alignment wording stays cautious + non-accusatory;
      no Constitution changes automatically; Home shows one quiet entry point
      with no streaks/points/metrics; review sessions persist after refresh.
      (23/23 automated checks, mock mode.)
- [x] `npm run lint` = 0, `npm run build` = 0.
- [x] **Production build** (`next start`) serves `/`, `/library`, `/inbox`,
      `/constitution`, and `/api/ai` (verifies no local-only assumption
      breaks a production server — the same runtime Vercel uses).
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
- [ ] Saved comparisons sync: create a comparison in Browser A → it appears
      in Browser B (same email). A second account cannot read it (RLS on
      `comparisons`).
- [ ] Saved inquiries sync: create an inquiry (and evolve it) in Browser A →
      it appears in Browser B with its full append-only history. A second
      account cannot read it (RLS on `inquiries`).
- [ ] Megathreads sync: create a thread (with members + a synthesis) in
      Browser A → it appears in Browser B with its members and synthesis. A
      second account cannot read it (RLS on `megathreads`).
- [ ] Formation sync: write a reflection, accept a practice, and run a weekly
      review in Browser A → they appear in Browser B. A second account cannot
      read them (RLS on `reflections`/`practices`/`review_sessions`). The
      reflection `response` cannot be overwritten (DB trigger).

## C. Real Anthropic (CREDENTIAL-DEPENDENT, pending)

Verify each task returns `"source":"ai"` (real) rather than `"mock"`:
```bash
for t in summary quotes concepts beliefs; do
  curl -s -X POST https://<prod-url>/api/ai -H "content-type: application/json" \
    -d "{\"task\":\"$t\",\"text\":\"Attention is the beginning of devotion.\"}" ; echo
done
```
- [ ] All four tasks (and a reader question) return `"source":"ai"`.
- [ ] Quote spans still resolve (candidate beliefs highlight correctly).
- [ ] Bad key / network fault → response is `"source":"mock","degraded":true`;
      the app keeps working (never a hard error to the user).

**Distinguishing real vs mock**: the JSON response `source` field is `"ai"`
for real Anthropic output and `"mock"` otherwise; a failed real attempt also
includes `"degraded":true`. In the UI, a source processed with real AI drops
the small "mock" tag.

**Diagnosing a failed real call** — check the Vercel function logs for
`[ai] task=… failed: <reason>` (source text and keys are never logged):

| Log reason        | Likely cause                                   |
|-------------------|------------------------------------------------|
| `anthropic_401`   | missing/invalid/expired `ANTHROPIC_API_KEY`    |
| `anthropic_400`   | malformed request / bad model params           |
| `anthropic_404`   | unsupported/misspelled `ANTHROPIC_MODEL`       |
| `anthropic_429`   | rate limited or **insufficient credits**       |
| `anthropic_5xx`   | Anthropic upstream issue                        |
| `The operation was aborted` | timeout (>25s) — rare; or Vercel runtime |
| `no JSON in response` / `empty proposals` | model output didn't parse |

If `source` is always `"mock"` even with a key set: the key isn't reaching
the server env (not set for that Vercel environment, or `NEXT_PUBLIC_`-
prefixed by mistake, or set only on Preview while testing Production).

## D. Failure resilience

- [ ] Simulate remote failure (wrong URL, or offline): writes still succeed
      locally ("Saved locally"/"Sync failed" with a **Retry** action);
      nothing is lost. Fix connectivity → **Retry** re-syncs.

## E. Full production chain (CREDENTIAL-DEPENDENT, pending)

Run against the live URL, signed in by email:
1. [ ] Open the live URL. 2. [ ] Sign in by email (magic link).
3. [ ] Add a manual text source. 4. [ ] Run analysis (real AI).
5. [ ] Save a quote. 6. [ ] Send a belief candidate to the Inbox.
7. [ ] Rewrite/accept it. 8. [ ] It appears in the Constitution.
9. [ ] Refresh → all data remains. 10. [ ] Second browser, same email →
same data loads. 11. [ ] Ask a Reader question → real Anthropic answer.

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
