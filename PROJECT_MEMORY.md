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

- Date: 2026-07-10
- **LIFEOS-004 — Durable persistence + real AI: implemented (this pass;
  Supabase path unverified pending credentials).** Added a Supabase schema
  (`supabase/migrations/0001_initial_schema.sql`: sources, captures,
  proposals, beliefs, belief_revisions, user_judgments, saved_quotes; UUID
  PKs; per-row `user_id`; RLS own-rows-only; append-only
  revisions/judgments/quotes; immutability triggers on original/capture
  text). Introduced a persistence **adapter** boundary (`lib/adapters/*`:
  `LocalPersistenceAdapter`, `SupabasePersistenceAdapter`) behind
  `lib/persistence.ts`, which keeps the store's instant local write and
  layers a debounced remote sync, one-time local→remote migration (never
  deletes local), and a "Saved locally / Syncing / Synced / Sync failed"
  indicator (`components/SyncStatus.tsx`) with Retry. Anonymous Supabase
  auth for the single-user MVP. Hardened the single `/api/ai` route
  (task/JSON validation → 400, 30s timeout, mock-degrade with `degraded`
  flag, no source-text logging, server-only key). **Local mode remains the
  default and is fully verified (9/9 flow + refresh persistence + sync
  label + AI 400s); Supabase/real-AI paths need the human to add
  credentials and run the migration — see `PERSISTENCE_QA.md`.** No new
  product features; UX unchanged.
- **LIFEOS-003 — Knowledge Engine MVP: implemented.** Added a
  Knowledge Library subsystem alongside (not replacing) the Belief Ledger.
  New screens: Library (`app/library/page.tsx` — browse/search/filter,
  add source) and Reader (`app/library/[id]/page.tsx` — read, highlight→
  save quote, ask one AI question, send selection/candidates to the Belief
  Inbox). New processing pipeline (`lib/pipeline.ts`): capture → extract →
  chunk → summary → quotes → concepts → candidate beliefs, each stage
  through the ONE AI route. Consolidated `/api/propose` → `/api/ai`
  (task-dispatched: summary/quotes/concepts/beliefs/question); the old
  route is deleted and Home now goes through `lib/aiClient`. Storage seam
  extracted to `lib/persistence.ts` (the Supabase swap point). Candidate
  beliefs never auto-enter the Constitution — they go through the existing
  Belief Inbox. Manual-text ingestion is fully automated; PDF/URL create
  typed, provenance-tracked sources that await their text in the reader
  (auto-extraction is a later ingestion adapter). Verified end-to-end in a
  browser (9/9 checks) incl. the LIFEOS-002 flow still working; `lint` and
  `build` green. Still localStorage-only (no Supabase/auth/deploy).
- Date: 2026-07-09
- **LIFEOS-002 — Belief Thread MVP: implemented.** First
  working product. Three client screens over a localStorage store (no
  DB): Home/Capture (`app/page.tsx`), Belief Inbox (`app/inbox/page.tsx`,
  one proposal at a time, Rewrite primary), Constitution
  (`app/constitution/page.tsx`, beliefs by theme, expandable, CSS-only
  thread line, re-judgeable over time). One AI call (`app/api/propose`)
  with deterministic mock fallback when `ANTHROPIC_API_KEY` is absent.
  MVP adapter types in `types/mvp.ts` (ontology in `types/lifeos.ts`
  untouched). Verified end-to-end in a real browser (capture → analyze →
  rewrite → accept → inbox clear → Constitution thread bends). `lint` and
  `build` green. Note: this is a client-only prototype; localStorage is
  per-browser and not yet backed by Supabase (LIFEOS-001 T3–T6 still
  open).
- Sprint 1, Day 1 — **LIFEOS-001** is in progress (its deploy/env tasks
  T3–T6 remain deferred; the MVP above runs locally without them).
  - **T1 — Scaffold the application: done.** Next.js (App Router,
    TypeScript, Tailwind, ESLint) app scaffolded; `npm run dev` / `build`
    / `lint` verified locally. Committed as `fe95773`.
  - **T2 — Repository hygiene & project memory: in progress.** Doc
    stabilization pass (`VISION.md` + `PROJECT_MEMORY.md` restructure)
    committed and pushed as `0164889` on `claude/lifeos-implementation-xwrikz`.
    Full T2 acceptance criteria (final push, `.env` hygiene verification)
    still open pending T3+.
  - **Foundation architecture pass (out-of-band, Product Owner-directed,
    before T3):** committed as `4f8b78b`. Added `PRINCIPLES.md`,
    `ONTOLOGY.md`, `ARCHITECTURE.md`, `AI_AGENT_RULES.md`,
    `types/lifeos.ts`. Docs/spec only — no database calls, no schema
    created, no secrets touched.
  - **Domain-model hardening pass (out-of-band, Product Owner-directed,
    before T3):** committed as `aac56e1`. Expanded `Source.type` beyond
    book/article, added `ProvenanceMeta` (createdBy/updatedBy/aiModel/
    sourceLocation/confidence/evidenceIds) to AI-touchable objects, and
    added `UserJudgment`. `types/lifeos.ts` + `ONTOLOGY.md` +
    `ARCHITECTURE.md` updated to match. Still docs/spec only.
  - **Cognitive architecture pass (out-of-band, Product Owner-directed,
    before T3):** committed as `f108aea`. Added `COGNITIVE_ARCHITECTURE.md`
    — the knowledge lifecycle, AI role architecture, event architecture,
    canonical identity system, object state machines, background
    pipelines, human oversight boundaries, failure modes, and future
    expansion path. Design document only — no code, database, Supabase,
    auth, API routes, or UI touched.
  - **Architecture pilot (out-of-band, Product Owner-directed, before
    T3):** committed as `618b13a`. Added `PILOT_GOSPEL_OF_THOMAS_SAYING_37.md`
    — a manual, hand-simulated run of the full 12-stage lifecycle against
    a real interpretive question (Gospel of Thomas, Saying 37), exhibiting
    all 13 core ontology object types and stress-testing them before any
    schema is written. Found real friction (`Book.authorIds` required —
    breaks on anonymous/pseudonymous works; `ArgumentPremise`
    claimId-vs-inline-statement promotion undefined; authorship
    representable two inconsistent ways) alongside real validation.
  - **Pilot lessons applied (out-of-band, Product Owner-directed, before
    T3):** committed as `8613477`. All Gospel of Thomas pilot findings
    applied: `Book.authorIds` optional, `authorAttribution` added to
    `Source` (types + `ONTOLOGY.md` authorship representation rule);
    `ONTOLOGY.md` `Argument` premise-promotion rule; pilot notes +
    trust-tiering spike in `COGNITIVE_ARCHITECTURE.md`; `confidence`
    marked uncalibrated in `ARCHITECTURE.md`.
  - **Adversarial product review + UX design freeze (out-of-band,
    Product Owner-directed, before T3):** in progress. A brutal external
    review (delivered in chat, not filed) recommended **NARROW**: freeze
    the docs, ship the boring LIFEOS-001 deploy, then build the minimal
    "belief ledger" and use it on a real book before writing more
    architecture. Following that, a Product Design Freeze produced
    `UX_SPECIFICATION.md` — the MVP interaction blueprint scoped to
    exactly three screens (Capture, Belief Inbox, Constitution), plus a
    ruthless six-week MoSCoW cut that REMOVEs most of the ontology's
    speculative objects and all of `COGNITIVE_ARCHITECTURE.md`'s
    pipeline/role/event machinery from MVP scope (deferred, not deleted).
    Design/spec only — no code, database, Supabase, auth, API routes, or
    UI components. See §7 and §8. **Note:** the review and UX spec are
    advisory design artifacts; they do not themselves change the frozen
    architecture or the `ONTOLOGY.md`/`types` on disk — any actual
    narrowing of the build is a future Product-Owner decision.
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
  Product Owner approval, consistent with existing docs. Committed and
  pushed as `4f8b78b`.
- 2026-07-09 — Domain-model hardening pass, explicitly directed by the
  Product Owner as a second out-of-band insertion before T3. Changed
  `types/lifeos.ts`: (1) widened `Source.type` from `book`/`article`-only
  to a 10-member `SourceType` union (`book`, `article`, `pdf`, `webpage`,
  `video`, `podcast`, `conversation`, `journal`, `image`, `other`) so the
  system doesn't assume all sources are books/articles, while `Book` and
  `Article` remain narrowed subtypes; (2) added a `ProvenanceMeta` mixin
  (`createdBy`, `updatedBy`, `aiModel`, `sourceLocation`, `confidence`,
  `evidenceIds`) applied to `Claim`, `Concept`, `Argument`,
  `ConstitutionEntry`, and `Relationship` — the objects most likely to be
  AI-touched or synthesized — folding in and removing `Claim`'s prior
  standalone `confidence` field as now redundant; (3) added `Actor`
  (`"user" | "ai"`) and `UserJudgment` (records accept/reject/question/
  revise verdicts on AI-proposed content) types, and added
  `"UserJudgment"` to `OntologyType`; (4) documented that `Relationship`
  already connects any two `OntologyType` members independently (no code
  change needed, just a clarifying comment). Updated `ONTOLOGY.md`
  (Source section, new UserJudgment section, cross-cutting notes) and
  `ARCHITECTURE.md` (future Supabase table list: added `user_judgments`,
  clarified `sources`/`books`/`articles` split) to match. Still
  design/spec and types only — no database calls, no Supabase schema
  created, no secrets touched. Committed and pushed as `aac56e1`.
- 2026-07-09 — Cognitive architecture pass, explicitly directed by the
  Product Owner as a third out-of-band insertion before T3. Added
  `COGNITIVE_ARCHITECTURE.md`: the process/verb layer sitting alongside
  `ONTOLOGY.md` (nouns) and `ARCHITECTURE.md` (tech shape) — Mission,
  12-stage Knowledge Lifecycle (Capture through Review, explicitly
  cyclical via Review feeding back into Capture/Compare/Revise), 10-role
  AI Role Architecture (explicitly scoped as functional/prompt-level
  personas within the one frozen AI route, not separate services),
  12-event append-only Event Architecture, Canonical Identity System
  (including a flagged open question: "Virtue" isn't a first-class
  ontology object yet, treated as a tagged `Concept` for now rather than
  unilaterally expanding the ontology), 7 object state machines, 9
  background pipelines, an explicit Human Oversight list ("AI proposes,
  human disposes"), 7 failure modes with safeguards, and a Future
  Expansion section arguing the ontology's center can stay fixed while
  expansion happens at the edges. Also linked the new doc from
  `README.md`. Design document only — no code, database, Supabase, auth,
  API routes, or UI components touched. A self-critique of this document
  was delivered directly to the Product Owner rather than embedded in the
  file, to keep the file's structure exactly as specified. Committed and
  pushed as `f108aea`.
- 2026-07-09 — Architecture pilot, explicitly directed by the Product
  Owner as a manual stress test before any database implementation. Added
  `PILOT_GOSPEL_OF_THOMAS_SAYING_37.md`: hand-simulated all 12 lifecycle
  stages against the question "what does Saying 37 reveal about spiritual
  nakedness, shame, perception, and realization?", producing illustrative
  example records for all 13 requested ontology object types (Source,
  Quote, Claim, Concept, Question, Argument, Relationship, Megathread,
  ConstitutionEntry, Practice, Reflection, Revision, UserJudgment), each
  labeled by content type (source text / summary / interpretation /
  ai-proposed / human-judgment placeholder). Flagged the Quote's own
  provenance honestly: its text was recalled from training data, not
  captured from an actual uploaded source, and is marked as unverified
  pending real capture — a deliberate, useful demonstration of
  `AI_AGENT_RULES.md` rule 2 rather than an oversight. Findings: real
  friction in `Book.authorIds` (required, breaks on the Gospel of
  Thomas's pseudonymous attribution), `ArgumentPremise`'s undefined
  claimId-vs-inline-statement promotion rule, and dual/inconsistent ways
  to represent authorship (`Source.authorIds` vs. a `Relationship`); real
  validation of `Quote`/`Claim`/`Relationship`/`Revision`/`UserJudgment`
  and the `ConstitutionEntry`→`Practice` state-machine gate (correctly
  prevented a `Practice` record from being created while its
  `ConstitutionEntry` stayed `draft`). Also confirmed, concretely, the
  previous pass's self-critique that "AI proposes, human disposes" has a
  real review-queue-volume problem: one saying alone produced 2 pending
  `UserJudgment`s, a contested claim pair, and a stuck-in-draft
  constitution entry. Recommendations were written into the pilot
  document only; `ONTOLOGY.md`, `types/lifeos.ts`, `ARCHITECTURE.md`, and
  `COGNITIVE_ARCHITECTURE.md` were deliberately left unmodified, per
  instruction, pending a future explicitly-scoped pass. Also linked the
  new doc from `README.md`. Design/analysis only — no code, database,
  Supabase, auth, API routes, or UI components touched.
- 2026-07-09 — Applied the Gospel of Thomas pilot's recommendations,
  explicitly approved by the Product Owner. Changed `types/lifeos.ts`:
  removed `Book`'s required-`authorIds` override (now inherits
  `Source.authorIds?: ID[]`) and added `AuthorAttribution` (`"confirmed"
  | "traditional" | "disputed" | "anonymous"`) plus
  `Source.authorAttribution?`, so anonymous/pseudonymous/disputed
  authorship (the normal case for the scripture/classical-text material
  in `VISION.md`'s scope, not an edge case) can be represented honestly
  instead of forcing a fabricated or overstated attribution. Placed on
  `Source` rather than only `Book` so `Article` and future source types
  inherit it too, per instruction. Updated `ONTOLOGY.md`: added an
  authorship representation rule (structural fields for stable/known
  attribution — including explicitly-uncertain attribution recorded as
  data — vs. `Relationship` records for contested/discovered/
  interpretive authorship claims) and an `Argument` premise-promotion
  rule (inline `ArgumentPremise.statement` is fine while `draft`, but
  every conclusion-supporting premise must be promoted to a real `Claim`
  before the `Argument` can go `active`). Updated
  `COGNITIVE_ARCHITECTURE.md`: added pilot notes under the Classify and
  Synthesize lifecycle stages (Classify may collapse into Extract for
  small captures; Compare and Synthesize may blur together in simple use
  cases — both framed as statements about stage granularity, not changes
  to what the stages produce), and added a "Future design spike:
  trust-tiering" subsection under §8 — explicitly **not designed yet**,
  proposing low-stakes proposals could someday get lighter-weight
  confirmation UX while every high-stakes decision already listed in §8
  continues to require the same explicit human judgment, with no
  lowering of that bar. Updated `ARCHITECTURE.md`: marked
  `ProvenanceMeta.confidence` as uncalibrated in the AI processing
  pipeline section, with an explicit rule that it must never be used for
  UI sorting/filtering/gating, review-queue auto-triage, or to drive any
  automated belief, `ConstitutionEntry`, or `Practice` change. Still
  docs/types only — no database calls, no Supabase schema created, no
  secrets touched, no API routes or UI components created. Committed and
  pushed as `8613477`.
- 2026-07-09 — Adversarial product review (delivered in chat, not filed
  to the repo) at Product Owner request: a deliberately skeptical
  external-architect critique concluding **NARROW** — freeze the docs,
  finish the LIFEOS-001 deploy, build the minimal "belief ledger" (paste
  → AI-proposed claims → human accept/rewrite/reject/question →
  Constitution page with provenance chains), and use it on a real book
  for two weeks before any further architecture. Flagged that the repo is
  currently exhibiting its own §1 failure mode (much architecture, zero
  usage) and that "AI proposes, human disposes" review-volume is the
  central viability question, not a refinement.
- 2026-07-09 — Product Design Freeze at Product Owner request: added
  `UX_SPECIFICATION.md`, the MVP interaction blueprint. Scopes the entire
  MVP to exactly three screens — Capture (frictionless immutable intake),
  Belief Inbox (one-card-at-a-time judgment, with inline Rewrite as the
  hero action because rewriting-in-your-own-words is where information
  becomes belief), and Constitution (worldview by theme, each belief
  expandable to its full belief→claim→quote→source provenance chain, with
  revision history and held-open questions). Answered the ten product
  questions (home screen = the Constitution; the one AI call = passage →
  1–3 quote-anchored claims; etc.) and produced a ruthless six-week
  MoSCoW ranking that REMOVEs Argument, Megathread, Project, Person,
  Tradition, Practice-as-object, the event system, all background
  pipelines, named AI roles, vector/graph/dedup, and surfaced
  `confidence` from MVP scope (deferred, not deleted). Design/spec only —
  no code, database, Supabase, auth, API routes, or UI components
  created; linked from `README.md`. This and the adversarial review are
  advisory: they do not modify the frozen architecture or the on-disk
  `ONTOLOGY.md`/`types/lifeos.ts`; any actual build-narrowing is a future
  Product-Owner call.
- 2026-07-09 — Implemented **LIFEOS-002 Belief Thread MVP**, the first
  working product, per the narrow scope. New files: `types/mvp.ts` (MVP
  adapter types mapped to the ontology; `types/lifeos.ts` untouched),
  `lib/proposals.ts` (deterministic mock proposal generator),
  `lib/mvpStore.ts` (localStorage-backed reactive store via
  `useSyncExternalStore`), `app/api/propose/route.ts` (the single AI call
  — one Anthropic `fetch` when `ANTHROPIC_API_KEY` is set, deterministic
  mock otherwise or on any failure), `components/{Nav,StoreHydrator,
  ThreadLine}.tsx`, `app/inbox/page.tsx`, `app/constitution/page.tsx`.
  Rewrote `app/page.tsx` (Home/Capture, replacing the scaffold default),
  updated `app/layout.tsx` (metadata + Nav + hydrator) and `globals.css`
  (sans font). Removed `app/api/.gitkeep` (real route now present). Data
  is localStorage only — no Supabase, no auth, no DB, per the "don't
  block on database setup" instruction. AI: one call only, no background
  agents/roles/embeddings/vector/graph search; no automatic Constitution
  changes without a user judgment. Verified with `npm run lint` (0),
  `npm run build` (0), and an end-to-end browser drive of the full
  capture→inbox→rewrite→accept→constitution loop, including the thread
  line rendering Proposed→Rewritten and a belief being questioned later.
  The `ANTHROPIC_API_KEY` path is written but UNTESTED (no key
  configured) — the mock fallback path is what was exercised. This is the
  first commit that adds runtime product code rather than docs/types.
- 2026-07-09 — QA + hardening pass on the LIFEOS-002 MVP (no new
  features, no UX redesign, no Supabase/auth/deploy). Bugs fixed: (1)
  `hydrate()` used `parsed.x ?? []`, which kept a non-array value from
  malformed/hand-edited localStorage and would crash later `map`/`filter`
  — now coerced via `Array.isArray`, and each belief's `revisions`/
  `judgments` are guaranteed to exist; (2) Home's double-submit guard
  relied on React state (`busy`), so a fast double-click could create a
  duplicate capture — added a synchronous `useRef` guard. Safeguards:
  `ThreadLine` guards `!revisions?.length`; added a `resetStore()` action
  and a confirm-gated "Reset local prototype data" footer on the
  Constitution page (plus a documented `localStorage.removeItem` manual
  path). Added `QA_CHECKLIST.md` (all requested flows + edge cases +
  reset + mock-fallback) and linked it from `README.md`. No automated
  test framework added — deliberately, per instruction, since the store
  depends on localStorage + `useSyncExternalStore`; QA is manual.
  Re-verified with `lint`, `build`, and a browser drive of the full loop
  plus the reset control and malformed-storage recovery. Product scope
  unchanged.
- 2026-07-10 — Implemented **LIFEOS-003 Knowledge Engine MVP**. Added the
  Knowledge Library as a subsystem beside the Belief Ledger (LIFEOS-002
  untouched in behavior). New files: `lib/persistence.ts` (the single
  storage seam — localStorage today, the one place to change for
  Supabase), `lib/mockAI.ts` (deterministic summary/quotes/concepts/
  answer mocks), `lib/aiClient.ts` (client wrapper for the one AI route,
  with local mock fallback), `lib/pipeline.ts` (chunking + the
  capture→…→candidate-beliefs pipeline), `lib/labels.ts`,
  `app/api/ai/route.ts` (the single task-dispatched AI route),
  `components/AddSource.tsx`, `app/library/page.tsx`,
  `app/library/[id]/page.tsx`. Extended `types/mvp.ts` (KnowledgeSource,
  chunk, processing/status enums; `Capture.sourceId`) reusing the
  ontology's `SourceType`. Extended `lib/mvpStore.ts` with `sources` +
  library actions/selectors, routed persist/hydrate through the seam, and
  normalized source arrays on hydrate. Deleted `app/api/propose/route.ts`;
  updated `app/page.tsx` and `components/Nav.tsx`; updated
  `QA_CHECKLIST.md` endpoint references. Candidate beliefs flow only
  through the existing Belief Inbox (never auto into the Constitution).
  Fixed a *test-harness* false failure (a `text=Read` selector matching
  the "Ready" processing label + clicking a Link before hydration) — the
  source→belief backlink itself was correct; direct-load inspection showed
  the provenance link resolving. Verified 9/9 in a browser (pipeline,
  send-to-inbox, judge, Constitution, source backlink, ask, save quote,
  search, and the LIFEOS-002 flow) with zero runtime errors; `lint` and
  `build` green. Still localStorage-only — no Supabase, auth, or deploy.
  Known deferral: automatic PDF/URL text extraction (a later ingestion
  adapter); today those inputs prompt for the text in the reader.
- 2026-07-10 — Implemented **LIFEOS-004 durable persistence + real AI**.
  Added `@supabase/supabase-js`; `supabase/migrations/0001_initial_schema.sql`
  (7 tables, UUID PKs, per-row `user_id`, RLS restricting each user to
  their own rows, append-only `belief_revisions`/`user_judgments`/
  `saved_quotes` via insert-only policies, and BEFORE-UPDATE triggers
  making `original_text` and capture `text` immutable). New code:
  `lib/supabase.ts` (client factory — null in local mode, throws only on
  half-configuration; reads only the two public vars), `lib/adapters/types.ts`
  (PersistenceAdapter interface), `lib/adapters/localAdapter.ts`,
  `lib/adapters/supabaseAdapter.ts` (relational row mapping;
  insert-or-ignore for append-only tables). Rewrote `lib/persistence.ts`
  as a facade: synchronous local write first, debounced remote sync
  second, sync-status observable, `retrySync`, and `initRemote` (anonymous
  sign-in + one-time local→remote migration keyed by user id that never
  deletes local data and prevents duplicate imports). Store gained
  `replaceState` (adopt remote without a re-push loop). New components
  `SyncStatus` (in Nav) and `PersistenceBootstrap` (in layout). Hardened
  `app/api/ai/route.ts`: validates task (400) and JSON (400), caps input,
  30s AbortController timeout, logs only failure reasons (never source
  text), and degrades to mock with a `degraded:true` flag so production
  clearly shows when mock is used. Updated `.env.example` (added
  `ANTHROPIC_MODEL`, clarified public vs server-only). Added
  `PERSISTENCE_QA.md` with the exact Supabase/Vercel manual steps and both
  checklists. Verified LOCAL mode end-to-end (9/9 flow, refresh
  persistence, "Saved locally" indicator, AI 400 validation, mock
  fallback) with lint+build green; confirmed the Anthropic key value is
  never in the client bundle (only the identifier appears inside a
  user-facing mock hint string). The Supabase and real-Anthropic paths are
  code-complete but UNVERIFIED here — no credentials were available; they
  activate automatically once the human adds env vars and runs the
  migration. No product features added; UX unchanged.
