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
