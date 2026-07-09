> **PROVISIONAL — NOT FINAL.** The canonical structure for this document is
> defined in Project Plan v1.0 §10, which has not yet been supplied to
> Claude Code. The 8-section structure below is a Product Owner-directed
> proposal (updated 2026-07-09). Do not treat section names, order, or
> content as authoritative until confirmed against Plan v1.0 §10. Likewise,
> the directory structure in §4 is provisional pending Project Plan v2.0
> §5.

# PROJECT_MEMORY.md

## 1. Product North Star

LifeOS is an AI-native operating system for lifelong intellectual,
personal, and spiritual formation. It turns books, articles, notes,
conversations, reflections, and lived experience into organized
knowledge, an evolving worldview synthesis, and practical life formation —
via scanning/capture, compiling, categorizing, organizing, note-taking,
quote saving, megathreads, knowledge graphs, and a Constitution Engine
that turns knowledge into an integrated way of life.

Single user. See `VISION.md` for the full statement (also provisional,
pending Product Owner approval).

## 2. Current Sprint Status

- Date: 2026-07-09
- Sprint 1, Day 1 — **LIFEOS-001** is in progress.
  - **T1 — Scaffold the application: done.** Next.js (App Router,
    TypeScript, Tailwind, ESLint) app scaffolded; `npm run dev` / `build`
    / `lint` verified locally. Committed as `fe95773`.
  - **T2 — Repository hygiene & project memory: in progress.** Doc
    stabilization pass (`VISION.md` + `PROJECT_MEMORY.md` restructure)
    committed and pushed as `0164889` on `claude/lifeos-implementation-xwrikz`.
    Full T2 acceptance criteria (final push, `.env` hygiene verification)
    still open pending T3+.
  - **Foundation architecture pass (out-of-band, Product Owner-directed,
    before T3):** in progress. Adds `PRINCIPLES.md`, `ONTOLOGY.md`,
    `ARCHITECTURE.md`, `AI_AGENT_RULES.md`, `types/lifeos.ts`. Docs/spec
    only — no database calls, no schema created, no secrets touched. See
    §7 and §8.
  - **T3–T6:** not started. Explicitly deferred — no Supabase, Anthropic,
    Vercel, or environment secret work has been done.
- What exists: scaffolded app only. No database tables, no auth, no AI
  calls, no deployment, no production URL.

## 3. Architecture Decisions

- Stack (frozen per Project Plan v2.0): Next.js (App Router, TypeScript)
  + Tailwind + Supabase + Vercel + Anthropic API.
- Single user; simple UI; AI will live in exactly one route (not built
  yet).
- No schema or stack deviations permitted without Product Owner approval
  + a Change Log entry (§8) logged **before** implementation.
- TypeScript strict mode is on (`tsconfig.json`).

## 4. File/Folder Structure

Only the structure explicitly known today is implemented; this is
provisional pending Project Plan v2.0 §5:

```
app/            # App Router routes
app/api/        # API routes (empty placeholder for now)
components/     # shared UI components (empty placeholder for now)
lib/            # shared utilities / clients (empty placeholder for now)
docs/           # project documentation (empty placeholder for now)
types/          # shared TypeScript types (empty placeholder for now)
```

`docs/` and `types/` were added at the Product Owner's request beyond the
ticket's original explicit list and are not yet confirmed against Plan
v2.0 §5.

## 5. Feature Roadmap

Immediate (this ticket, LIFEOS-001):
- Finish T2 (this pass) → T3 (env config) → T4 (health check page) → T5
  (Vercel deploy) → T6 (close-out). Each remains blocked on inputs listed
  in §7.

Next ticket:
- **LIFEOS-002: Auth + RLS**

Longer-term (from `VISION.md`, not sequenced or committed yet — capability
list only, sourced from the vision direction given 2026-07-09):
- Scanning / capture
- Compiling & categorizing
- Organizing & note-taking
- Quote saving
- Megathreads
- Knowledge graphs
- Constitution Engine

None of the longer-term items are scheduled. They are recorded here so
future sprint planning has a reference point, not as a commitment to
scope or order.

## 6. AI/Agent Instructions

- Architecture is FROZEN per Project Plan v2.0 — do not introduce new
  stack components, schema, or structural deviations without explicit
  Product Owner approval logged in §8 *before* implementation.
- Never invent or fabricate secrets, credentials, or "approved" document
  content (e.g. VISION.md, Plan v1.0/v2.0 text). Where real content is
  missing, use clearly marked placeholders/provisional drafts and stop to
  ask, per the governing ticket's instructions.
- Do not build outside the scope of the current ticket/task instruction,
  even if adjacent work seems natural to do while in the file.
- Keep this document's §2 and §7 current at the end of every work session.
- §8 (Change Log) is append-only — never edit or delete prior entries.

## 7. Open Questions / Blockers

- `VISION.md` is a strong provisional draft, not the Product Owner's
  final approved document — needs sign-off.
- This document's own structure needs sign-off against Plan v1.0 §10.
- Directory structure (§4) needs sign-off against Plan v2.0 §5 — `docs/`
  and `types/` are unconfirmed additions.
- Supabase Project URL + anon key: not yet provided.
- Anthropic API key: not yet provided.
- Vercel deploy approach (dashboard vs. CLI token): not yet decided.
- These block T3 (env config), T4 (health check page needs Supabase
  client), and T5 (Vercel deploy) respectively.

## 8. Change Log (append-only)

- 2026-07-09 — `npm`'s package-name rules reject capital letters, and the
  repo directory is `LifeOS`. Scaffolded `create-next-app` into a temp
  directory using the lowercase name `lifeos`, then moved the generated
  files into the repo root (excluding `node_modules`, reinstalled in
  place). `package.json`'s `"name"` field is `"lifeos"`. No effect on app
  behavior or the frozen stack.
- 2026-07-09 — `create-next-app`'s default `.gitignore` used a blanket
  `.env*` pattern, which would have also ignored `.env.example` (required
  to be committed). Replaced it with explicit `.env`, `.env.local`,
  `.env.*.local` entries plus a `!.env.example` negation.
- 2026-07-09 — `create-next-app` also generates `AGENTS.md` and a
  one-line `CLAUDE.md` by default. Removed both as out of scope for this
  ticket; not part of the requested file list.
- 2026-07-09 — Proceeded with T1 (scaffolding) only, per explicit Product
  Owner instruction, while VISION.md, Plan v1.0 §10, Plan v2.0 §5,
  Supabase credentials, Anthropic key, and Vercel deploy approach remained
  outstanding. T1 committed as `fe95773` and pushed to
  `claude/lifeos-implementation-xwrikz`.
- 2026-07-09 — T2 documentation stabilization pass: replaced placeholder
  `VISION.md` with a strong provisional vision draft (per Product Owner
  direction) and restructured `PROJECT_MEMORY.md` to an 8-section format
  (Product North Star / Current Sprint Status / Architecture Decisions /
  File-Folder Structure / Feature Roadmap / AI-Agent Instructions / Open
  Questions-Blockers / Change Log), also per explicit Product Owner
  direction. Both remain provisional pending final Plan v1.0 §10 and Plan
  v2.0 §5. Committed and pushed as `0164889` (repo stop hook required a
  clean working tree).
- 2026-07-09 — Foundation architecture pass, explicitly directed by the
  Product Owner as an out-of-band insertion before T3: added
  `PRINCIPLES.md`, `ONTOLOGY.md`, `ARCHITECTURE.md`, `AI_AGENT_RULES.md`,
  and `types/lifeos.ts`. This is design/spec and TypeScript type
  definitions only — no database calls, no Supabase schema created, no
  secrets touched, no product features implemented. Flagged here because
  the governing LIFEOS-001 ticket's Definition of Done says "nothing
  outside this ticket's scope was built"; this pass is scope the Product
  Owner explicitly requested mid-session, layered on top of the ticket
  rather than replacing it. All new docs are marked provisional pending
  Product Owner approval, consistent with existing docs.
