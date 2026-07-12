# LifeOS Architecture

> **PROVISIONAL — DESIGN/SPEC ONLY.** This document proposes a durable
> technical architecture for the LifeOS MVP. Nothing here has been
> implemented. No database tables exist, no migrations have been written,
> and no API routes call a database. This is a plan to be reconciled
> against Project Plan v1.0/v2.0 and approved before implementation
> begins (database work starts at LIFEOS-003 per the frozen roadmap).

## Guiding constraint

The stack is frozen: **Next.js (App Router, TypeScript) + Tailwind +
Supabase + Vercel + Anthropic API**, single user. This document works
within that constraint — it does not propose alternatives to it.

## Next.js app structure

```
app/                      # App Router routes (pages + layouts)
app/api/                  # Route handlers — thin, delegate to lib/
components/               # Shared, reusable UI components
lib/                      # Clients, domain logic, server-only utilities
  lib/supabase.ts         # Supabase client (browser + server variants)
  lib/db/                 # Future: typed data-access functions per ontology object
  lib/ai/                 # Future: Anthropic client + prompt/pipeline logic
docs/                     # Project documentation (this file and friends)
types/                    # Shared TypeScript types
  types/lifeos.ts         # Domain model (see below)
  types/supabase.ts       # Future: generated Supabase DB types
```

Route handlers in `app/api/` should stay thin — validate input, call a
function in `lib/`, return a response. Domain logic belongs in `lib/`,
not in route handlers or components, so it stays testable independent of
Next.js.

## TypeScript domain types

`types/lifeos.ts` defines the ontology from `ONTOLOGY.md` as TypeScript
interfaces, independent of any database representation. This is
deliberate: the domain model should be able to survive a future storage
change (e.g. a schema refactor) without every consumer of the types
changing. Supabase-generated types (`types/supabase.ts`, not created yet)
will represent the *storage* shape; a thin mapping layer in `lib/db/`
will translate between storage rows and domain types when that layer is
built.

## Supabase/Postgres tables (future — not created yet)

When LIFEOS-003 implements the database, the expected table shape
(subject to the Product Owner's Plan v2.0 §5 confirmation) is one table
per concrete ontology object in `ONTOLOGY.md`, plus shared tables for the
generic cross-cutting objects (`Relationship`, `Revision`,
`UserJudgment`):

```
sources, books, articles, notes, quotes, claims, concepts, people,
traditions, arguments, questions, megathreads, constitution_entries,
practices, reflections, projects
relationships    -- generic typed edges (fromType/fromId/toType/toId)
revisions        -- generic append-only version history
user_judgments   -- generic append-only human verdicts on AI-proposed content
```

`sources` covers the full `SourceType` union (`book`, `article`, `pdf`,
`webpage`, `video`, `podcast`, `conversation`, `journal`, `image`,
`other`) via its `type` column; `books` and `articles` hold only the
fields specific to those two narrowed subtypes. The other source types
have no dedicated table yet — they live in `sources` alone until/unless a
narrowed subtype is warranted.

Notes on this shape, for future implementation:

- `books` and `articles` likely reference a shared `sources` row (or use
  table inheritance / a `source_type` discriminator column) rather than
  duplicating shared fields — exact approach to be decided at
  implementation time, not now.
- Row-level security (RLS) is explicitly out of scope until LIFEOS-002.
  Since this is a single-user system, RLS today would be scoped to "rows
  belong to the one authenticated user" — a decision to make concretely
  in LIFEOS-002, not here.
- `revisions` and `quotes` (and other immutable-by-design objects) should
  have database-level protections against UPDATE/DELETE on the immutable
  fields once implemented (e.g. triggers or RLS policies), not just
  application-level discipline — enforcing `PRINCIPLES.md` §6 at the data
  layer, not just in the UI.

## Retrieval layer (LIFEOS-009 — implemented, deterministic)

Intelligent Library retrieval is **implemented and deterministic** — no
embeddings, no `pgvector`, no AI route, no background jobs. It runs
entirely in the browser over the in-memory store.

- **Records as a view, not a copy** (`lib/retrieval/records.ts`).
  `buildRecords(state)` projects the existing store into normalized
  `RetrievalRecord`s (one per source / summary / concept / quote / chunk /
  candidate belief / capture / unresolved proposal / belief / earlier
  revision). Records are rebuilt transiently on demand and are **never
  persisted** — they duplicate no large source text on disk. Every record
  keeps provenance (`sourceId`, `page`, `href`) so results are explainable.
- **Explainable ranking** (`lib/retrieval/search.ts`). `search()` scores
  each record with weighted, inspectable signals: exact phrase (×6),
  concept overlap (×4), token overlap (×3), title/author match (×2), page
  provenance, belief-status boost, and recency (×0.5) — exact and concept
  matches are deliberately weighted above recency. Each result carries a
  human "why it matched" `Reason`; **raw scores are never shown in the
  UI**. Results are deduped by normalized text and diversified with a
  per-source cap. `relatedTo(text, …)` is the same engine tuned for
  contextual "what else relates to this" (limit 5, one per source).
- **Feedback tunes ranking only** (`retrieval_feedback`, migration 0004).
  `relevant` boosts, `not_relevant`/`dismissed` suppress, `snoozed` hides
  until `snooze_until`. This is a deterministic re-rank/filter — **not** an
  ML recommender, and it never changes a belief or its status.
- **Where it surfaces.** Library search (grouped by type, with provenance
  and why-matched), Home capture resurfacing (async, after save, ≤1
  primary + up to 2 more, never blocking the save), Constitution
  per-belief related evidence (collapsed, never auto-resolving
  contradictions), and Reader "find related from your library" (collapsed,
  excludes the current source).

The section below describes a *possible future* semantic layer. It is
**not** a description of today's retrieval, which is the deterministic
engine above. A future migration to embeddings would sit behind the same
`search`/`relatedTo` seams.

## Comparative intelligence (LIFEOS-010 — implemented)

Cross-source comparison is **implemented** on top of the deterministic
retrieval layer. It compares 2–5 sources (or a belief + sources) while
preserving genuine differences and exact provenance. No graph UI, no
megathreads, no background agents, and it never changes beliefs or the
Constitution automatically.

- **Deterministic evidence packet** (`lib/comparison/evidence.ts`).
  `buildEvidence(state, inputs, question)` assembles a small, provenance-
  bearing packet from data already in the store: per source — metadata,
  summary, ≤3 representative chunk summaries, ≤4 exact quotes (page/offset),
  ≤6 concepts, ≤3 candidate claims; per belief — its text; per passage — the
  exact quote. The LIFEOS-009 retrieval engine (`search`) ranks which
  quotes/chunks are most relevant to the comparison question. Per-source
  caps plus a total `MAX_PACKET_CHARS` budget keep whole books from being
  sent. Every item gets a stable id (`E1…En`) and records AI/mock origin +
  coverage.
- **One structured AI call, then verification** (`lib/comparison/run.ts`).
  The packet → a single `compare` call on the existing `/api/ai` route →
  strict validation (`lib/comparison/schema.ts`) that **drops any point
  whose `evidenceIds` are not in the packet** (unsupported prose never
  becomes a conclusion; it is flagged). For larger comparisons (≥4 sources)
  an optional second `compare_verify` pass reviews the draft. The mock
  (`lib/mockCompare.ts`) produces a real, evidence-cited result offline, so
  the whole flow works with no API key.
- **Terminology & contradiction care** (Phases 7–8). The prompt and
  validator require cautious language ("resembles", "may parallel", "differs
  because") and flag flattening phrasing ("identical", "interchangeable").
  Each disagreement is classified (logical / practical / definitional /
  level-of-analysis / historical / ambiguity) — not every difference is a
  contradiction.
- **Human judgment** (`components/ComparisonResult.tsx`). Every insight is a
  proposal: Accept → the existing Belief Inbox, Rewrite → Inbox, Question,
  Reject, or just save the comparison. Judgments are append-only on the
  `Comparison`; the Constitution is never touched automatically.
- **Persistence.** A comparison is one row (`comparisons`, migration
  `0005_comparative_intelligence.sql`) with jsonb `inputs`/`evidence`/
  `result`/`judgments`, own-rows RLS. Local fallback stores it in the same
  state blob. Entry points: Nav, Library, Reader ("compare with another
  source"), Constitution ("compare this belief with sources").

## Dialectical intelligence (LIFEOS-011 — implemented)

Structured reasoning is **implemented** on top of the retrieval (LIFEOS-009)
and comparison (LIFEOS-010) layers. An **inquiry** investigates one question
through evidence, arguments, objections, and unresolved tensions — it never
decides what the user must believe, and never changes the Constitution.

- **Evidence packet** (`lib/dialectic/evidence.ts`). `buildInquiryEvidence`
  reuses the comparison evidence builder for source/belief/passage inputs,
  then appends dialectic-specific evidence — belief **revisions**, prior
  **comparison findings**, and **terminology** disputes — continuing the same
  `E1…En` id sequence. Same per-source + total caps; whole books are never
  sent.
- **One structured call, then verification** (`lib/dialectic/run.ts`). Packet
  → a single `dialectic` call on `/api/ai` → strict validation
  (`lib/dialectic/schema.ts`) that **drops any substantive assertion whose
  `evidenceIds` are not in the packet** (flagged, never shown as grounded) →
  optional `dialectic_verify` second pass for ≥4 sources. The mock
  (`lib/mockDialectic.ts`) is deliberately honest: it derives an affirmative
  case from question/word overlap and states plainly that it cannot detect a
  genuine counter-position, rather than fabricating fake symmetric balance.
- **Argument quality** (Phase 5). Points carry an `argType` (premise /
  conclusion / objection / rebuttal / qualification / analogy / definition /
  empirical / interpretive / theological / personal_judgment); the schema
  names reasoning defects (invalid inference, hidden assumption, equivocation,
  circular reasoning, unsupported generalization) only when present, flags
  false-certainty language ("proves", "definitively") over interpretive
  evidence, and never treats all disagreement as logical contradiction.
- **Strict result** (`DialecticResultData`): question, definitions,
  assumptions, strongest affirmative/negative cases, supporting evidence,
  counterarguments, rebuttals, terminology disputes, distinctions, unresolved
  ambiguities, possible syntheses, what-would-change-the-conclusion, questions
  for the human, relation-to-beliefs, reasoning issues, limitations/coverage.
- **Human judgment + evolution** (`components/DialecticResult.tsx`,
  `app/inquiry/[id]`). Each insight is a proposal: Accept/Rewrite → the
  existing Belief Inbox, Question, Reject, or save without adopting. The user
  writes their own provisional conclusion and sets status
  (open/provisional/unresolved/resolved). Re-running with added sources pushes
  the prior result into **append-only `history`** — reasoning is never
  overwritten.
- **Persistence.** One row (`inquiries`, migration
  `0006_dialectical_intelligence.sql`) with jsonb `inputs`/`evidence`/
  `result`/`history`/`judgments`, own-rows RLS. Entry points: Nav, Compare
  ("investigate this question"), Constitution ("challenge this belief"),
  Reader ("investigate this passage").

## Future vector search layer

Not implemented. When built, the expected approach is `pgvector` on
Supabase/Postgres (avoiding a second database system, consistent with the
frozen stack) with embeddings generated via the Anthropic API or a
dedicated embedding model, stored alongside (not replacing) the
full-text/relational data. Vector search is additive — a way to find
relevant `Note`/`Quote`/`Claim`/`Concept` records — not a replacement for
the `Relationship`-based graph structure.

## Future graph/relationship layer

The `Relationship` object (see `ONTOLOGY.md`) is the graph layer: typed
edges between any two ontology objects, stored relationally rather than
in a separate graph database — again, consistent with the frozen stack
(no new database system). Graph traversal queries (e.g. "everything that
supports this Claim, transitively") are expected to be recursive CTEs in
Postgres or an application-level traversal over `relationships` rows, to
be decided at implementation time based on actual query patterns once
there's real data.

## Document ingestion pipeline (future)

Not implemented. Expected shape, for planning purposes only:

1. **Capture** — user submits raw material (pasted text, a URL, an
   uploaded file, or a quote typed directly).
2. **Parse/normalize** — extract clean text, metadata (title, author,
   date where available), and structural markers (pages, paragraphs).
3. **Source creation** — a `Source` (and `Book`/`Article` subtype) record
   is created or matched against an existing one (avoid duplicate
   Sources for the same book/article).
4. **Segment capture** — `Quote`/`Note` records are created from
   user-selected or user-written material, always linked back to the
   `Source`.
5. **Optional AI-assisted extraction** — AI may propose `Claim`/`Concept`
   links as *proposals* (status: `ai-proposed` / `proposed`), never as
   accepted facts — the user confirms or rejects (`AI_AGENT_RULES.md`,
   `PRINCIPLES.md` §2).

No AI calls are implemented as part of this architecture pass — this is
a description of the intended future shape only.

## AI processing pipeline (future)

Not implemented. The Anthropic API key exists only in `.env.local` /
`.env.example` today and is referenced nowhere in code (per LIFEOS-001
T3). When built, AI involvement is expected to be scoped to exactly one
route (per the frozen constraint "AI will live in exactly one route"),
and to only ever:

- Propose (not assert) `Claim`, `Concept`, or `Relationship` records for
  user confirmation
- Draft (not finalize) summaries, tagging suggestions, or
  `ConstitutionEntry` synthesis proposals, always attributable and always
  reviewable before becoming `active`/`accepted`
- Never write directly to `Quote.text`, `Reflection.body`, or any other
  field this document or `ONTOLOGY.md` marks immutable

**`confidence` is uncalibrated — do not build against it as if it means
anything yet.** `ProvenanceMeta.confidence` exists in `types/lifeos.ts`
today as a bare `0–1` number with no defined scoring method. The Gospel
of Thomas pilot assigned confidence values "by feel" when illustrating
example records, which is exactly the failure mode to avoid in real
code: a number that *looks* meaningful without *being* meaningful is more
dangerous than no number at all, because it invites downstream logic to
trust it. Concretely, until a calibration approach is designed and
documented:

- Do not sort, filter, or gate any UI list by `confidence`.
- Do not use `confidence` to auto-triage the human review queue (see
  `COGNITIVE_ARCHITECTURE.md` §8's trust-tiering design spike — that
  spike, when it happens, is the place calibration would need to be
  solved first, not `confidence` as it exists today).
- **`confidence` must never drive an automated belief change, a
  `ConstitutionEntry` status transition, or a `Practice` change of any
  kind** — those remain human-only decisions regardless of what any
  confidence number says (`COGNITIVE_ARCHITECTURE.md` §8).

## Export/backup strategy (future)

Not implemented. Required property, per `PRINCIPLES.md` §5: the user must
always be able to get all their data out in a usable, non-proprietary
form. Planned approach:

- A full-export function producing structured JSON (one file/section per
  ontology object type) that round-trips through the domain types in
  `types/lifeos.ts` — not a database dump tied to Supabase internals.
- Supabase's own automated backups cover disaster recovery; the export
  feature is a separate, user-facing guarantee against lock-in and is not
  satisfied by Supabase backups alone.

## Error handling principles

- Fail loud locally, fail soft in the UI. `lib/supabase.ts` (built in
  T3) throws a clear error at startup if required env vars are missing —
  that pattern (explicit, human-readable errors at the boundary) should
  extend to any future `lib/` client.
- User-facing surfaces (like the T4 health check) must never crash or
  blank-screen on a backend failure — they degrade to a clear status
  message instead. This applies to all future features touching
  Supabase/Anthropic, not just the health check.
- Errors that touch data integrity (a failed `Revision` write, a failed
  ingestion step) must not silently drop data — partial failures should
  leave the system in a recoverable state (e.g. a `Source` created but
  its `Quote`s not yet linked, rather than losing the captured text).

## Security and secret-handling principles

- Secrets live only in `.env.local` (git-ignored) and the deployment
  platform's environment variable store (Vercel) — never in code, never
  committed, never logged.
- `.env.example` documents required variable names with placeholder
  values only — this is already true today and must stay true as new
  variables are added.
- The Anthropic key specifically stays unreferenced in code until the
  one AI route is actually built (frozen constraint, T3).
- Once RLS is implemented (LIFEOS-002), it is the enforcement boundary
  for data access — application-level checks are a UX convenience, not a
  substitute for RLS.
- No secret, credential, or API key is ever invented or fabricated by an
  AI agent working on this repo — see `AI_AGENT_RULES.md`.
