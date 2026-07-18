# Generation 1 Release Validation — v1.0.0-rc1 → v1.0.0

> Scope: validation only. No new feature subsystem, no migration beyond 0020,
> no architectural change. This document is the working checklist for cutting
> `v1.0.0-rc1`, running the credentialed + dogfooding validation, and promoting
> to `v1.0.0`. File findings with the **Finding** issue template
> (`.github/ISSUE_TEMPLATE/finding.yml`).

---

## 1. Production schema compatibility (through migration 0020)

**Already verified (sandbox, Postgres 16):** the complete chain
`0001 → 0020` applies **in order on a fresh database with zero errors**
(0010/pgvector runs only where the extension exists — i.e. on Supabase),
produces **29 tables with RLS enabled on all 29**, and the **entire chain
re-runs idempotently**.

**Verify on the production Supabase project** (SQL Editor, read-only):

```sql
-- a. All 29 Generation-1 tables present?
select count(*) as gen1_tables from information_schema.tables
where table_schema = 'public' and table_name in (
  'sources','captures','proposals','beliefs','belief_revisions','user_judgments',
  'saved_quotes','retrieval_feedback','comparisons','inquiries','megathreads',
  'reflections','practices','review_sessions','reasonings','embeddings',
  'decisions','formation_sessions','concepts','concept_relationships',
  'principles','frameworks','knowledge_projects','research_projects',
  'dialogue_sessions','tensions','syntheses','recommendations','user_prefs');
-- expected: 29 (embeddings requires pgvector — created by 0010)

-- b. RLS enabled everywhere?
select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
-- expected: zero rows

-- c. Every table owns its rows (user_id default present)?
select table_name from information_schema.columns
where table_schema = 'public' and column_name = 'user_id'
  and column_default not like 'auth.uid()%';
-- expected: zero rows
```

Any non-expected result is a **blocker finding** before rc1.

---

## 2. Credentialed Supabase acceptance checklist

Prerequisites: production (or staging) Supabase URL + anon key in env; two
test accounts **A** and **B** (email magic link); two browsers or one browser
+ one private window.

- [ ] **Authenticated hydration.** Sign in as A on a device with an empty
      local store. Expect: remote data adopts into the store; every module
      renders it; indicator reaches **Saved**.
- [ ] **Sign-out / sign-in persistence.** As A: create a capture, sign out
      (expect **Saved locally** and data still visible), sign back in.
      Expect: no data loss, no duplicates, indicator returns to **Saved**.
- [ ] **Incremental sync.** With the network tab open, edit ONE belief.
      Expect: upserts hit only the changed domain's table (dirty-domain
      gating), not all 29; `/health` shows the dirty domain clearing.
- [ ] **Onboarding preference mirroring.** Complete the tour as A on device 1.
      On device 2, sign in as A with cleared localStorage. Expect:
      `/welcome` shows "already completed"; `user_prefs` has the row.
- [ ] **RLS isolation (two users).** See §3 — all six steps pass.
- [ ] **Retry and reconnect.** With data pending, go offline (dev-tools
      offline). Expect indicator **Offline — saved locally**. Go online.
      Expect automatic flush → **Saved** with no user action. Then simulate
      failure (temporarily wrong anon key): expect **Retrying… (n/5)** with
      backoff, then **Sync error** + manual Retry; local data intact
      throughout; `/health` lists the errors.
- [ ] **Stale local state adoption.** Device with OLD local data for A signs
      in after A changed data elsewhere. Expect: remote (newer) adopts;
      old local state does not clobber remote; `lifeos.migrated.v1`
      updated. Then: local data belonging to B on a device where A signs in
      — expect A starts clean and B's local data is NOT migrated into A.
- [ ] **Duplicate-write prevention.** Rapid-fire 10 edits in <2s, then let
      sync settle; run the browser online/offline toggle mid-burst.
      Expect: exactly one row per record id (`select id, count(*) …
      group by id having count(*) > 1` returns zero rows on every table);
      no interleaved partial states on reload.

## 3. Two-user RLS test plan

Users **A** and **B**, signed in simultaneously (two browsers).

1. **Seed A.** As A: one capture→accepted belief, one dialogue with a
   detected tension + synthesis, one research project, run an Inbox scan.
2. **Read isolation.** As B: every module renders EMPTY (no captures,
   beliefs, dialogues, tensions, recommendations from A). `/health` counts
   are all zero for B.
3. **Write isolation.** As B: create one belief. As A: reload — A does not
   see B's belief; A's counts unchanged.
4. **API-level probe.** In B's browser console, query A's data directly:
   `await supabase.from('beliefs').select('*')` — expect ONLY B's rows.
   Repeat for `tensions`, `recommendations`, `user_prefs`. Expect the same.
5. **Update/delete probe.** As B, attempt
   `supabase.from('beliefs').update({text:'x'}).eq('id','<A-row-id>')` and a
   matching delete. Expect zero rows affected (RLS), A's data unchanged.
6. **Prefs isolation.** B completes onboarding. A's `/welcome` state is
   unaffected, and each `user_prefs` row carries the correct `user_id`.

Every step must pass with **zero cross-user leakage**; any leak is a
release-blocking, data-loss-risk finding.

## 4. Seven-day dogfooding plan (centered on /today)

Daily loop (10–20 min):
- [ ] **Start at `/today`** — every session, every day. Note anything you
      needed that the page did not surface (finding: `daily-home`).
- [ ] **Capture ≥1 real thought**; judge every proposal in the Belief Inbox
      the same day (accept / rewrite / question / reject).
- [ ] **Act on ≥1 LifeOS Inbox recommendation** (or dismiss/snooze with a
      reason you'd stand behind).
- [ ] **Advance one open thread of work** — a dialogue turn, a tension
      synthesis, a research note, or a decision update.
- [ ] **Glance at the sync indicator** at session end — anything other than
      *Saved / Saved locally* gets investigated via `/health`.

Scheduled:
- [ ] Day 1: complete onboarding fresh (restart the tour), file friction.
- [ ] Day 2: one formation reflection from a `repeat_reflection` card.
- [ ] Day 3: mid-week `/health` review — zero problem-severity findings.
- [ ] Day 4: mobile-only day (phone browser) — file any layout/usability finding.
- [ ] Day 5: force one offline session mid-edit; verify recovery on reconnect.
- [ ] Day 6: review "Recently completed" on /today — does it reflect the week?
- [ ] Day 7: full pass — `/health` clean, integrity checks all ok/info,
      re-run the two-user probe (§3 steps 2 and 4), retrospective notes filed.

Exit criteria: **zero data-loss incidents, zero blocking findings, /today
was genuinely the daily starting point** (subjective but recorded).

## 5. Release criteria

### v1.0.0-rc1 (cut when ALL true)
- [ ] LIFEOS-025 merged; migration 0020 applied to production.
- [ ] §1 production schema queries return expected results.
- [ ] Full local gates green at the rc commit: lint, production build, all
      E2E suites (incl. gen1 41/41).
- [ ] `/health` on production build: no problem-severity integrity finding.
- [ ] Tag `v1.0.0-rc1` on the merged main commit; record the commit SHA here: ______

### v1.0.0 (promote rc1 when ALL true)
- [ ] §2 credentialed acceptance checklist fully passed.
- [ ] §3 two-user RLS plan fully passed (zero leakage).
- [ ] §4 seven-day dogfood completed with exit criteria met.
- [ ] One real-Anthropic session exercised each AI-backed flow once
      (capture→proposals, compare, inquiry, thread synthesis, reasoning,
      decision analysis, formation synthesis, authoring draft) with valid
      citations and no schema failures.
- [ ] All findings triaged: zero open `severity: blocker` or `data-loss: yes`.
- [ ] Accessibility spot-audit of the five daily-path pages (Today, Capture,
      Belief Inbox, LifeOS Inbox, Dialogue) with a screen reader; findings filed.
- [ ] Tag `v1.0.0`; `/health` scorecard reviewed one final time.

## 6. Rollback procedure

**App rollback (any time):** redeploy the previous tag (`vercel rollback` or
redeploy the prior deployment). All schema changes are additive — an older
app runs safely against a newer schema; unknown localStorage fields are
preserved by the store's tolerant hydration.

**Migration 0020:** no rollback needed. If required anyway:
`drop table if exists public.user_prefs;` loses ONLY onboarding/tour state —
never knowledge. No other Gen-1 migration requires a down path (all additive).

**Local data:** never wiped by rollback. If a device shows corrupt data, the
original blob is preserved at `localStorage['lifeos.mvp.v1.corrupt']` —
export it before any manual repair.

**Remote data:** rollback never deletes rows. If a bad sync is suspected,
sign out (freezes remote writes; local-only mode continues) and investigate
via `/health` + the §1 queries before signing back in.

**RC failure:** findings that block → fix on a hotfix branch from the rc tag,
re-run the affected checklist section, cut `v1.0.0-rc2`. Never fix-forward on
main without re-tagging.
