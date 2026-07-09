# LifeOS Ontology

> **PROVISIONAL.** This defines the first-class objects LifeOS is built
> around. It has not been reconciled against Project Plan v1.0/v2.0 and is
> not yet approved by the Product Owner. Nothing here implies a database
> table exists yet — see `ARCHITECTURE.md` for how this eventually maps to
> Supabase/Postgres. The corresponding TypeScript shapes live in
> `types/lifeos.ts`.

Each object below defines: **Purpose**, **Required fields**, **Optional
fields**, **Relationships**, and **Mutability** (Immutable / Mutable /
Versioned — see the cross-cutting notes at the end for what these mean).

---

## Source

**Purpose:** The abstract parent of any originating material the user
consumes or captures from outside their own head. `Book` and `Article`
are concrete specializations today; future types (video, podcast,
conversation transcript) extend the same base without inventing a new
top-level concept. `Source` is the anchor provenance points back to.

- **Required fields:** `id`, `type` (discriminator), `title`,
  `capturedAt`, `provenance` (`human` | `import`)
- **Optional fields:** `authorIds` (→ Person), `publishedAt`, `url`,
  `identifier` (ISBN/DOI/etc.), `description`, `tags`
- **Relationships:** has many `Quote`, `Note`, `Claim` extracted from it;
  references `Person` as author(s); may belong to one or more `Project`
- **Mutability:** Mutable metadata (title corrections, tags); identity is
  treated as append-only — corrections happen via field edits, not
  delete/replace.

## Book

**Purpose:** A bounded, long-form published work. A `Source` subtype.

- **Required fields:** `id`, `title`, `authorIds`
- **Optional fields:** `isbn`, `edition`, `publisher`, `publishedYear`,
  `totalPages`
- **Relationships:** extends `Source`; has many `Quote`/`Note`/`Claim`,
  typically scoped by page or location
- **Mutability:** Mutable metadata; identity immutable once created.

## Article

**Purpose:** A shorter, often web- or periodical-published work. A
`Source` subtype.

- **Required fields:** `id`, `title`
- **Optional fields:** `authorIds` (articles are sometimes unauthored),
  `venue`, `url`, `publishedAt`
- **Relationships:** extends `Source`
- **Mutability:** Mutable metadata; identity immutable once created.

## Note

**Purpose:** The user's own freeform writing connected to something in
the system — active thinking, made visible. Distinct from `Reflection`
(personal/internal journaling) and `Claim` (a discrete assertion).

- **Required fields:** `id`, `body`, `createdAt`, `authorship` (always
  `user` — AI does not author Notes on the user's behalf; see
  `AI_AGENT_RULES.md`)
- **Optional fields:** `title`, `tags`, linked refs (`Source`, `Concept`,
  `Claim`, `Question`)
- **Relationships:** many-to-many with `Source`, `Concept`, `Claim`,
  `Question`, `Megathread`, `Project` (via `Relationship`)
- **Mutability:** Mutable, but edits are versioned — history isn't lost.

## Quote

**Purpose:** An exact, verbatim excerpt from a `Source`, preserved
word-for-word for provenance and later reference.

- **Required fields:** `id`, `sourceId`, `text` (verbatim), `location`
  (page/paragraph/timestamp, as available)
- **Optional fields:** `context` (surrounding text), `tags`
- **Relationships:** belongs to one `Source`; referenced by many
  `Note`/`Claim`/`Argument`/`Megathread` entries
- **Mutability:** **Immutable.** `text` must never be edited once
  captured. A transcription error is fixed via a `Revision` that records
  both old and new text — never a silent overwrite. This is the concrete
  data-layer enforcement of "never overwrite source text."

## Claim

**Purpose:** A discrete, checkable assertion — extracted from a `Source`
or formulated by the user (AI-proposed claims are explicitly marked
pending confirmation). The atomic unit of *what is asserted*, separate
from the reasoning that supports it (`Argument`) and from raw text
(`Quote`).

- **Required fields:** `id`, `statement`, `provenance`
  (`source-derived` | `user-authored` | `ai-proposed`), `status`
  (`proposed` | `accepted` | `contested` | `retracted`)
- **Optional fields:** `sourceId`/`quoteId`, `confidence`, `tags`
- **Relationships:** may cite `Quote`/`Source`; supported/contested by
  `Argument`; connects to `Concept`; may contradict other `Claim`s (via
  `Relationship`)
- **Mutability:** **Versioned.** Material changes to `statement` produce
  a `Revision` rather than a silent edit — disagreement and change must
  stay visible, not erased.

## Concept

**Purpose:** A named idea or topic node used to organize and connect
material across sources — the primary "what is this about" unit of the
knowledge graph.

- **Required fields:** `id`, `name`, `description`
- **Optional fields:** `aliases`, `tags`, `relatedTraditionIds`
- **Relationships:** many-to-many with `Note`, `Claim`, `Quote`, `Source`,
  `Question`, `Argument`, `Person`, `Tradition` (via `Relationship`)
- **Mutability:** **Versioned.** A `Concept`'s description evolves as
  understanding deepens; material redefinitions produce a `Revision` so
  the user can see how their understanding changed over time.

## Person

**Purpose:** An individual — author, thinker, historical figure, or
conversation partner — referenced elsewhere in the system.

- **Required fields:** `id`, `name`
- **Optional fields:** `bio`, `birthDate`, `deathDate`, `traditionIds`,
  `aliases`, `externalLinks`
- **Relationships:** authors `Source`(s); associated with `Tradition`(s);
  referenced by `Claim`/`Argument`/`Quote`/`Note`
- **Mutability:** Mutable — low-stakes biographical metadata, not
  interpretation; not versioned by default.

## Tradition

**Purpose:** An intellectual, philosophical, religious, or cultural
school of thought or lineage that contextualizes `Person`s, `Claim`s, and
`Concept`s.

- **Required fields:** `id`, `name`, `description`
- **Optional fields:** `parentTraditionId` (for sub-traditions/lineages),
  `tags`
- **Relationships:** associated with `Person`(s), `Concept`(s),
  `Argument`(s)
- **Mutability:** Mutable, low churn.

## Argument

**Purpose:** A structured chain of reasoning — premises leading to a
conclusion — that supports, contests, or refines one or more `Claim`s.
Where the system represents *why*, not just *what*.

- **Required fields:** `id`, `conclusionClaimId`, `premises` (ordered
  list of `Claim` refs or inline statements), `status` (`draft` |
  `active` | `superseded`)
- **Optional fields:** `counterArgumentIds`, `sourceId`, `tags`
- **Relationships:** concludes in a `Claim`; premises reference `Claim`s;
  may reference/contest other `Argument`s; associated with
  `Concept`/`Tradition`/`Person`
- **Mutability:** **Versioned.** A change to an `Argument`'s structure is
  a meaningful event in the user's reasoning and must be tracked.

## Question

**Purpose:** An explicit, open line of inquiry that drives capture and
synthesis — "what am I still trying to understand," made first-class and
queryable instead of implicit.

- **Required fields:** `id`, `text`, `status` (`open` | `in-progress` |
  `resolved` | `abandoned`)
- **Optional fields:** `relatedConceptIds`, `resolutionClaimId`, `tags`
- **Relationships:** linked to `Note`/`Claim`/`Argument`/`Megathread`
  entries that address it; may resolve into a `ConstitutionEntry`
- **Mutability:** Mutable status/links; a materially reworded question
  text is versioned, since a reworded question can be a different
  question.

## Megathread

**Purpose:** A long-running, evolving accumulation of thought on a single
topic or question that persists across many sessions — explicitly not a
chat log that resets, but a durable, growable object.

- **Required fields:** `id`, `title`, `status` (`active` | `dormant` |
  `archived`)
- **Optional fields:** `description`, `relatedConceptIds`,
  `relatedQuestionIds`
- **Relationships:** aggregates `Note`/`Quote`/`Claim`/`Reflection`/
  `Argument` entries over time (ordered, append-friendly); linked to
  `Project`
- **Mutability:** Mutable container — metadata (`title`, `status`) is
  mutable; accumulated history is not rewritten, only appended to.

## ConstitutionEntry

**Purpose:** A single articulated principle or commitment in the user's
personal Constitution — the Constitution Engine's output unit. Where
synthesized knowledge becomes a stated way of living.

- **Required fields:** `id`, `statement`, `status` (`draft` | `active` |
  `retired`), `derivedFrom` (list of `Claim`/`Argument`/`Reflection`
  refs)
- **Optional fields:** `relatedPracticeIds`, `tags`
- **Relationships:** derived from `Claim`(s)/`Argument`(s)/
  `Reflection`(s); connects to one or more `Practice`; may retire/supersede
  a prior `ConstitutionEntry`
- **Mutability:** **Versioned**, explicitly, and the highest-stakes object
  in the ontology. Every material change produces a `Revision`;
  retirement references what it supersedes rather than deleting it.

## Practice

**Purpose:** A concrete, trackable behavior or habit that operationalizes
a `ConstitutionEntry` — where a stated principle becomes something
actually done.

- **Required fields:** `id`, `title`, `status` (`active` | `paused` |
  `dropped`), `constitutionEntryId`
- **Optional fields:** `cadence`, `description`, `tags`
- **Relationships:** implements one `ConstitutionEntry`; may link to
  `Reflection` entries logging practice over time
- **Mutability:** Mutable status, but status-change history is preserved
  (versioned) — "why did I drop this practice" is formation-relevant
  data.

## Reflection

**Purpose:** The user's personal, internal writing about their own
experience, state, or process — journaling in the classic sense, and the
rawest input the Constitution Engine draws from. Distinct from `Note`
(which is about external material).

- **Required fields:** `id`, `body`, `createdAt`
- **Optional fields:** `mood`, `tags`, `relatedConstitutionEntryIds`,
  `relatedPracticeIds`, `relatedMegathreadId`
- **Relationships:** may inform `ConstitutionEntry` synthesis; may link
  to a `Practice` (as a log entry) or `Megathread`
- **Mutability:** **Immutable** in spirit, like a journal entry — the
  historical record of what the user felt/thought at a point in time is
  not silently rewritten. Corrections/elaborations are new `Reflection`s
  or `Revision`s referencing the original.

## Revision

**Purpose:** A first-class, append-only record of a material change to
any versioned object (`Concept`, `Claim`, `Argument`,
`ConstitutionEntry`, `Practice` status, etc.). Makes "versioned"
mutability concrete and queryable.

- **Required fields:** `id`, `targetType`, `targetId`, `previousValue`,
  `newValue`, `changedAt`, `changeReason` (`human` | `ai-proposed`, plus
  optional free text)
- **Optional fields:** `authorId` (reserved for multi-user future; today
  always the single user or AI acting under the user's direction)
- **Relationships:** references exactly one target object of any
  versioned type
- **Mutability:** **Immutable.** A `Revision` is itself a historical
  record — never edited or deleted once created.

## Project

**Purpose:** An organizing container for a body of ongoing work or
inquiry (e.g. "write a book," "understand Stoicism this year") that
groups `Question`s, `Megathread`s, `Note`s, and other objects toward a
purpose, without itself being part of the knowledge graph's content.

- **Required fields:** `id`, `title`, `status` (`active` | `paused` |
  `completed` | `archived`)
- **Optional fields:** `description`, `tags`, `targetDate`
- **Relationships:** groups `Question`(s), `Megathread`(s), `Note`(s),
  in-progress `ConstitutionEntry` work
- **Mutability:** Mutable — status and grouping change freely;
  organizational, not epistemic content, so not versioned by default.

## Relationship

**Purpose:** A first-class, typed edge connecting any two ontology
objects — the explicit mechanism behind "knowledge graphs." Cross-object
connections that carry meaning (supports, contradicts, cites, part-of,
etc.) are modeled as records so the graph is queryable and extensible
without schema churn.

- **Required fields:** `id`, `fromType`, `fromId`, `toType`, `toId`,
  `relationType` (`supports` | `contradicts` | `cites` | `responds-to` |
  `part-of` | `derived-from` | `related-to` | `authored-by` |
  `member-of` — extensible), `createdAt`
- **Optional fields:** `note` (short annotation), `strength`
- **Relationships:** is itself the relationship mechanism — references
  its two endpoints, has no relationships of its own
- **Mutability:** Mutable, but deletion is soft (`status`: `active` |
  `retracted`) rather than hard — "I used to think these were related"
  should not be silently lost.

---

## Cross-cutting notes

- **Provenance is structural, not cosmetic.** Every object that can
  originate from a `Source` or from AI assistance carries an explicit
  provenance field (see `types/lifeos.ts`). This enforces `PRINCIPLES.md`
  §3 at the schema level, not just as a UI convention.
- **What Immutable / Versioned / Mutable mean here:**
  - **Immutable** (`Quote`, `Reflection`, `Revision`) — the historical
    record must never change. Corrections create new records that
    reference the old one.
  - **Versioned** (`Claim`, `Concept`, `Argument`, `ConstitutionEntry`,
    `Practice` status) — the *current* value can change, but every
    material change produces a `Revision`, so nothing is lost, only
    superseded.
  - **Mutable** (`Person`, `Tradition`, `Project`, `Relationship`,
    `Source`/`Book`/`Article` metadata) — ordinary in-place edits are
    fine; the object is low-stakes metadata or explicitly organizational
    rather than epistemic content.
- **This ontology is provisional.** It has not been reconciled against
  Project Plan v1.0/v2.0. See `ARCHITECTURE.md` for how it eventually
  maps (not yet implemented) to Supabase tables.
