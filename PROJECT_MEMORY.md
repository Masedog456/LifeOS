> **PROVISIONAL — NOT FINAL.** The canonical 8-section structure for this
> document is defined in Project Plan v1.0 §10, which has not yet been
> supplied to Claude Code. The structure below is a reasonable proposal
> only. Do not treat section names, order, or content as authoritative
> until the Product Owner confirms them against Plan v1.0 §10.

# PROJECT_MEMORY.md

## 1. Project Overview

LifeOS is a personal intelligence OS (single user). See `VISION.md`
(currently a placeholder — pending the approved document).

## 2. Current State

- Date: 2026-07-09
- LIFEOS-001 (Sprint 1, Day 1) is **in progress**. Only **T1 — Scaffold the
  application** has been completed so far.
- What exists: a Next.js (App Router, TypeScript, Tailwind, ESLint) app
  scaffolded with `npm run dev` / `npm run build` verified locally.
- What does NOT exist yet: Supabase wiring, `lib/supabase.ts`, the health
  check homepage, `.env.local`, Vercel deployment, any production URL.
- No database tables, no auth, no AI calls — none are in scope yet.
- Production URL: none yet — to be recorded here once T5 is complete.

## 3. Next Up

- Immediate: finish remaining LIFEOS-001 tasks (T2–T6) — repository
  hygiene/commit, environment configuration, health check page, Vercel
  deploy, session close-out. Blocked on: VISION.md (approved content),
  Project Plan v1.0 §10 (PROJECT_MEMORY.md structure), Project Plan v2.0 §5
  (full directory structure), Supabase URL/anon key, Anthropic API key,
  and a decision on Vercel deploy access.
- After LIFEOS-001 is fully done: **LIFEOS-002: Auth + RLS**

## 4. Architecture & Stack (Frozen)

- Next.js (App Router, TypeScript) + Tailwind + Supabase + Vercel +
  Anthropic API
- Single user; simple UI; AI will live in exactly one route (not built yet)
- Architecture status: FROZEN per Project Plan v2.0 — no schema or stack
  deviations permitted without Product Owner approval + a Decisions Log
  entry logged BEFORE implementation.

## 5. Directory Structure

Only the structure explicitly known today is implemented:

```
app/            # App Router routes
app/api/        # API routes (empty placeholder for now)
components/     # shared UI components (empty placeholder for now)
lib/            # shared utilities / clients (empty placeholder for now)
docs/           # project documentation (empty placeholder for now)
types/          # shared TypeScript types (empty placeholder for now)
```

**Note:** Project Plan v2.0 §5 (the full, final directory structure) has not
been supplied. `docs/` and `types/` were added at the Product Owner's
request beyond the ticket's explicit list and are not yet confirmed against
Plan v2.0 §5. Treat this whole section as provisional until Plan v2.0 §5 is
confirmed.

## 6. Environment & Secrets

- `.env.example` documents the required variables:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `ANTHROPIC_API_KEY`.
- No `.env.local` exists yet — secrets have not been provided.
- No secret values have ever been committed to this repository.

## 7. Decisions Log (append-only)

- 2026-07-09 — `npm`'s package-name rules reject capital letters, and the
  repo directory is `LifeOS`. Scaffolded `create-next-app` into a temp
  directory using the lowercase name `lifeos`, then moved the generated
  files into the repo root (excluding `node_modules`, which was
  reinstalled in place). `package.json`'s `"name"` field is `"lifeos"`.
  No effect on app behavior or the frozen stack.
- 2026-07-09 — `create-next-app`'s default `.gitignore` used a blanket
  `.env*` pattern, which would have also ignored `.env.example` (required
  to be committed). Replaced it with explicit `.env`, `.env.local`,
  `.env.*.local` entries plus a `!.env.example` negation.
- 2026-07-09 — `create-next-app` also generates `AGENTS.md` and a
  one-line `CLAUDE.md` by default. Removed both as out of scope for this
  ticket; not part of the requested file list.
- 2026-07-09 — Proceeded with T1 (scaffolding) only, per explicit Product
  Owner instruction, while VISION.md, Plan v1.0 §10, Plan v2.0 §5,
  Supabase credentials, Anthropic key, and Vercel deploy approach remain
  outstanding. T2–T6 are intentionally not started.

## 8. Open Questions / Risks

- VISION.md placeholder must be replaced with the approved document
  verbatim before T2 can be considered complete.
- PROJECT_MEMORY.md's own structure (this document) needs Product Owner
  sign-off against Plan v1.0 §10.
- Final directory structure needs sign-off against Plan v2.0 §5 — `docs/`
  and `types/` are unconfirmed additions.
- Vercel deploy approach (dashboard vs. CLI token) needs a decision before
  T5.
