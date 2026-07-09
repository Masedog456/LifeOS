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
    T3):** in progress. Adds `PILOT_GOSPEL_OF_THOMAS_SAYING_37.md` — a
    manual, hand-simulated run of the full 12-stage lifecycle against a
    real interpretive question (Gospel of Thomas, Saying 37), exhibiting
    all 13 core ontology object types and stress-testing them before any
    schema is written. Found real friction (`Book.authorIds` required —
    breaks on anonymous/pseudonymous works; `ArgumentPremise`
    claimId-vs-inline-statement promotion is undefined; authorship can be
    represented two inconsistent ways) alongside real validation (Quote/
    Claim/Relationship/Revision/UserJudgment and the
    ConstitutionEntry/Practice state-machine gate all held up under a
    genuinely hard case). Recommendations recorded in the pilot doc
    itself, not yet applied to `ONTOLOGY.md`/`types/lifeos.ts`/
    `ARCHITECTURE.md`/`COGNITIVE_ARCHITECTURE.md` — pending a future,
    explicitly-scoped pass. Design/analysis only. See §7 and §8.
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
