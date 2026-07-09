# LifeOS Cognitive Architecture

> **PROVISIONAL — DESIGN DOCUMENT ONLY.** This is the conceptual operating
> model for how knowledge moves through LifeOS. It is not a technical
> implementation document: no code, database, Supabase schema,
> authentication, API route, or UI component is created or modified by
> this document. Nothing here has been approved by the Product Owner. It
> is intended to be the master blueprint every future feature, table,
> API, AI agent, and user interaction is checked against — see
> `ONTOLOGY.md` (the nouns: first-class objects), `ARCHITECTURE.md` (the
> technical shape), `PRINCIPLES.md` (the values), and `AI_AGENT_RULES.md`
> (the behavioral rules) for the documents this one sits alongside. This
> document is the *process* layer — the verbs connecting those nouns.

---

## 1. Mission

LifeOS is an AI-native operating system for lifelong intellectual,
personal, and spiritual formation.

Its purpose is not to store information. A perfectly organized archive
that no one returns to is a failure state (`PRINCIPLES.md` §1). LifeOS
exists to run a specific transformation, repeatedly, over years:

**information → coherent understanding → wisdom → practices → lived
formation.**

- **Information** is raw material: a book, an article, a conversation, a
  fleeting thought.
- **Coherent understanding** is information that has been extracted,
  classified, connected, and compared against everything else the user
  knows — not isolated facts, but a structure.
- **Wisdom** is understanding that has been synthesized and reflected on
  long enough to be trusted — including the discipline of knowing what is
  still contested or unknown.
- **Practices** are wisdom translated into recurring, concrete action.
- **Lived formation** is the accumulated effect of practices, honestly
  observed over time — not a claimed state, but an emergent one.

Every section below exists to make one property true: **nothing skips a
step.** Information cannot masquerade as wisdom. AI proposals cannot
masquerade as accepted knowledge. A single dramatic insight cannot
masquerade as formation. The system's job is to make the *whole pipeline*
visible and honest, not to make any one stage fast.

---

## 2. Knowledge Lifecycle

The lifecycle is not strictly linear — **Review** feeds back into
**Capture**, **Compare**, and **Revise**; **Reflect** can happen at any
stage, not only after Synthesize. It is presented in order because each
stage's *typical* inputs are the previous stage's *typical* outputs, not
because material always moves through it in one direction.

### Capture

- **Purpose:** Get raw material into the system with minimal friction and
  zero loss.
- **Inputs:** Pasted text, uploaded files, URLs, typed quotes,
  conversation transcripts, journal entries — anything from outside the
  system.
- **Outputs:** A `Source` record (any `SourceType`) and/or directly
  captured `Quote`/`Note` records, timestamped and provenance-tagged.
- **AI responsibilities:** Normalize formatting; propose detected
  metadata (title, author, date) as a suggestion, never invented
  (`AI_AGENT_RULES.md` rule 2).
- **Human responsibilities:** Initiate the capture; confirm or correct
  detected metadata.
- **Success criteria:** Nothing captured is ever lost or blocked on
  classification; every captured item has a `Source` anchor and a
  timestamp before anything else happens to it.

### Extract

- **Purpose:** Pull discrete, quotable, checkable units out of raw
  captured material.
- **Inputs:** `Source`/`Note` raw text.
- **Outputs:** `Quote` records (verbatim) and candidate `Claim`
  proposals.
- **AI responsibilities:** Propose quote boundaries and candidate claims
  (`status: proposed`, `provenance: ai-proposed`); never invent text
  (rule 1).
- **Human responsibilities:** Confirm which passages matter; correct
  extraction boundary errors.
- **Success criteria:** Every `Quote` traces to an exact source location;
  no `Claim` exists without provenance.

### Classify

- **Purpose:** Attach initial categorical structure so material is
  findable before deep understanding happens.
- **Inputs:** `Source`/`Quote`/`Claim`/`Note`.
- **Outputs:** Tags, weak/candidate `Concept` links, confirmed
  `SourceType`.
- **AI responsibilities:** Suggest tags and candidate `Concept` links via
  pattern/embedding similarity; check the Canonical Identity System (§5)
  and flag likely duplicates rather than silently creating new Concepts.
- **Human responsibilities:** Approve/adjust classification; resolve
  ambiguous duplicate flags.
- **Success criteria:** Everything captured has at least provisional
  classification; false-positive duplicate `Concept` creation stays rare.

### Understand

- **Purpose:** Move from "this text exists" to "what does this text
  mean" — producing checkable claims and refined concept definitions.
- **Inputs:** Classified material.
- **Outputs:** `Claim` proposals with statements; `Concept` description
  refinements proposed as `Revision`s.
- **AI responsibilities:** Draft candidate claims/summaries with
  `evidenceIds` and `confidence` populated; keep summary, source, and
  interpretation strictly separated (`PRINCIPLES.md` §6).
- **Human responsibilities:** Review and record a `UserJudgment`
  (accept/reject/question/revise) on each proposal.
- **Success criteria:** Claims are falsifiable statements, not vague
  paraphrase; the provenance chain from claim back to source is unbroken.

### Connect

- **Purpose:** Link new material into the existing graph.
- **Inputs:** Accepted `Claim`s/`Concept`s.
- **Outputs:** `Relationship` proposals (`supports`, `cites`,
  `related-to`, etc.).
- **AI responsibilities:** Propose relationships with evidence and
  confidence, using embedding/graph heuristics (Researcher role, §3).
- **Human responsibilities:** Confirm relationships, especially
  epistemically weighty types (`supports`, `contradicts`) — see §8.
- **Success criteria:** The graph accretes without runaway false
  connections; no `contradicts` relationship is ever auto-accepted.

### Compare

- **Purpose:** Surface agreement and disagreement across claims,
  sources, and traditions — explicitly, not silently.
- **Inputs:** Connected claims/arguments across a `Concept`'s
  neighborhood.
- **Outputs:** Explicit `contradicts` relationships, flagged tension
  sets, candidate `Question`s capturing unresolved tension.
- **AI responsibilities:** Surface possible contradictions; never resolve
  them (`PRINCIPLES.md` §4 — preserve disagreement before synthesis).
- **Human responsibilities:** Decide whether a tension is genuine and
  worth tracking as an open `Question`.
- **Success criteria:** No contradiction is silently dropped or silently
  merged into a false consensus.

### Synthesize

- **Purpose:** Draft a coherent higher-level view once material has been
  compared, without finalizing it.
- **Inputs:** Compared claims, arguments, open questions.
- **Outputs:** `Argument` records; draft `ConstitutionEntry` proposals
  (`status: draft` only).
- **AI responsibilities:** Draft syntheses with a full `derivedFrom`
  chain; never set a `ConstitutionEntry` to `active` (Synthesizer role,
  §3).
- **Human responsibilities:** Is the actual synthesizer of record —
  approves, edits, or rejects every draft.
- **Success criteria:** Every active `ConstitutionEntry` traces through
  `derivedFrom` to real evidence; no synthesis skips Compare.

### Reflect

- **Purpose:** Let the user process material personally — how it bears on
  their life, questions, and experience.
- **Inputs:** Synthesized material and lived experience.
- **Outputs:** `Reflection` records — always human-authored, immutable.
- **AI responsibilities:** May prompt reflection questions; never authors
  a `Reflection` (same rule as `Note` — user-only).
- **Human responsibilities:** Entirely human-authored, by definition.
- **Success criteria:** Reflections accumulate as an honest, unedited
  internal record over time.

### Revise

- **Purpose:** Update existing concepts/claims/arguments/constitution
  entries as understanding matures, without erasing history.
- **Inputs:** Reflection, new evidence, time.
- **Outputs:** `Revision` records; updated versioned objects.
- **AI responsibilities:** May propose a revision (`ai-proposed`); never
  applies it directly.
- **Human responsibilities:** Approves/executes revisions to their own
  concepts and constitution.
- **Success criteria:** Nothing is silently overwritten; every material
  change is queryable history.

### Constitution

- **Purpose:** Crystallize mature, accepted understanding into an
  actionable principle and linked practice — where knowledge becomes a
  stated way of living.
- **Inputs:** Active/mature claims, arguments, and reflections.
- **Outputs:** `ConstitutionEntry` (`active`), linked `Practice` records.
- **AI responsibilities:** May propose candidate entries/practices from
  patterns across accepted material — draft only, always.
- **Human responsibilities:** The **sole** authority to move a
  `ConstitutionEntry` to `active`. This is the highest-stakes human-only
  gate in the entire system (§8).
- **Success criteria:** Every active entry has a clear `derivedFrom`
  lineage and an explicit human confirmation, never an automatic one.

### Practice

- **Purpose:** Actually do the thing — track behavior tied to a
  constitution entry over time.
- **Inputs:** An active `ConstitutionEntry`.
- **Outputs:** `Practice` status updates; `Reflection` log entries tied to
  the practice.
- **AI responsibilities:** May remind, track cadence, and surface
  patterns ("you've paused this three times") — Coach role (§3).
- **Human responsibilities:** Performs the practice; decides whether to
  continue, pause, or drop it.
- **Success criteria:** Practice history shows honest engagement, not
  unused aspirational entries.

### Review

- **Purpose:** Periodically look back across the whole system — has
  understanding coalesced, are old claims still trusted, is the
  constitution actually being lived?
- **Inputs:** The full accumulated history across every stage.
- **Outputs:** Flagged stale/contested items; review-triggered
  `Question`s/`Revision`s; retired `ConstitutionEntry` records.
- **AI responsibilities:** Surfaces candidates for review — a
  summarization/surfacing role only, never a decision-making one.
- **Human responsibilities:** Performs the actual review judgment;
  decides what changes.
- **Success criteria:** Nothing rots silently. Review is the mechanism
  that prevents the "pile of notes nobody returns to" failure state named
  in `PRINCIPLES.md` §1 — and the reason Review feeds back into Capture,
  Compare, and Revise rather than being a dead end.

---

## 3. AI Role Architecture

The frozen architecture constraint states AI lives in exactly one route
(`ARCHITECTURE.md`). The ten roles below are **functional/prompt-level
personas within that single route**, not separate services or
infrastructure — a role is a mode of reasoning the one AI integration
adopts for a given task, not a different system. This distinction matters
for staying inside the frozen stack while still getting the benefit of
role separation: different responsibilities, different limits, different
required evidence.

### Librarian
- **Responsibilities:** Cataloging, classification, metadata hygiene,
  tagging, findability.
- **Limitations:** No interpretive judgment about truth or meaning.
- **Allowed actions:** Propose tags/classification; detect near-duplicate
  `Source`s; suggest metadata corrections.
- **Forbidden actions:** Cannot create or accept `Claim`s; cannot alter
  the Constitution.
- **Required evidence:** The source's own metadata.
- **Expected outputs:** Classification proposals, dedup flags.

### Archivist
- **Responsibilities:** Preserving `Quote`s/`Source`s/`Reflection`s
  exactly; enforcing immutability rules; guarding `Revision` trail
  integrity.
- **Limitations:** Does not interpret content.
- **Allowed actions:** Create a `Revision` record when a correction is
  human-confirmed; run integrity checks (§7).
- **Forbidden actions:** Never edits `Quote.text` or `Reflection.body`
  directly (rule 1).
- **Required evidence:** Original captured text plus explicit
  human-confirmed correction.
- **Expected outputs:** `Revision` records, integrity reports.

### Researcher
- **Responsibilities:** Finding connections; gathering supporting and
  opposing evidence for claims.
- **Limitations:** Cannot assert truth, only surface evidence.
- **Allowed actions:** Propose `Claim`/`Concept`/`Relationship` records as
  `ai-proposed`; search the existing corpus.
- **Forbidden actions:** Cannot mark a `Claim` `accepted`; cannot
  fabricate citations (rule 2).
- **Required evidence:** Quotes/sources/existing claims cited by id.
- **Expected outputs:** Proposals with `evidenceIds` populated.

### Synthesizer
- **Responsibilities:** Drafting higher-order `Argument`s and
  `ConstitutionEntry` candidates from accepted material.
- **Limitations:** Cannot resolve genuine contradictions on the user's
  behalf; cannot finalize a `ConstitutionEntry`.
- **Allowed actions:** Draft `Argument`s and `ConstitutionEntry`s
  (`status: draft`).
- **Forbidden actions:** Setting `ConstitutionEntry.status` to `active`;
  silently dropping conflicting claims.
- **Required evidence:** Full `derivedFrom` chain.
- **Expected outputs:** Drafts pending `UserJudgment`.

### Historian
- **Responsibilities:** Tracking how the user's understanding of a
  concept/claim/entry evolved via `Revision` history; contextualizing
  people/traditions historically.
- **Limitations:** Grounded in the user's own corpus plus explicitly
  flagged general knowledge — not a silent encyclopedia.
- **Allowed actions:** Surface `Revision` timelines; propose
  `Tradition`/`Person` enrichment, clearly flagged as general knowledge.
- **Forbidden actions:** Presenting general historical knowledge as if it
  were the user's own captured material.
- **Required evidence:** `Revision` records, or an explicit
  external-knowledge flag.
- **Expected outputs:** Timeline views, clearly-flagged historical
  context notes.

### Philosopher
- **Responsibilities:** Probing logical structure of `Argument`s, testing
  validity, surfacing unstated premises, conceptual clarification.
- **Limitations:** Does not adjudicate the user's ultimate values.
- **Allowed actions:** Propose additional premises/counter-arguments;
  flag logical gaps.
- **Forbidden actions:** Declaring an `Argument` "sound" as a final
  verdict.
- **Required evidence:** The argument's own premises and conclusion.
- **Expected outputs:** Critique notes, candidate counter-arguments.

### Theologian
- **Responsibilities:** Engaging religious/spiritual claims and
  traditions with the same rigor as philosophical ones; tracking
  tradition-specific frameworks.
- **Limitations:** The single most sensitive role — never presents a
  religious/spiritual conclusion as objectively settled.
- **Allowed actions:** Surface tradition-internal reasoning; cite
  tradition sources; map claims to `Tradition`.
- **Forbidden actions:** Synthesizing a final personal
  theological/spiritual conclusion on the user's behalf; privileging one
  tradition's claims over another's without explicit user direction.
- **Required evidence:** `Source`/`Quote` from within the relevant
  tradition's material.
- **Expected outputs:** Tradition-mapped claims/arguments, explicitly
  flagged as requiring human religious/spiritual judgment before any
  Constitution-level acceptance (§8).

### Devil's Advocate
- **Responsibilities:** Actively generating counter-arguments and
  stress-testing claims/entries the user is close to accepting — the
  concrete mechanism behind `PRINCIPLES.md` §4.
- **Limitations:** Has no "home" position; exists purely to surface the
  strongest opposing case.
- **Allowed actions:** Propose `counterArgumentIds`; flag when a
  claim/entry is being accepted without a documented opposing view.
- **Forbidden actions:** Cannot block an acceptance outright — advisory
  only — but must run before any `ConstitutionEntry` goes active (§8).
- **Required evidence:** The claim/entry under test, plus any corpus
  material that could contest it.
- **Expected outputs:** Counter-argument drafts, "untested acceptance"
  flags.

### Coach
- **Responsibilities:** Supporting practice adherence — reminders,
  pattern surfacing, encouragement.
- **Limitations:** Does not set or alter the `ConstitutionEntry` a
  practice implements.
- **Allowed actions:** Propose cadence adjustments; surface
  practice-related `Reflection` patterns.
- **Forbidden actions:** Creating or modifying `ConstitutionEntry`/
  `Practice` records without human action; moralizing about adherence.
- **Required evidence:** `Practice` status history, related reflections.
- **Expected outputs:** Nudges, pattern summaries, cadence suggestions.

### Memory Keeper
- **Responsibilities:** Maintaining recall across `Megathread`s and
  long-running `Project`s/`Question`s so continuity survives across
  sessions — the "not a chat log that resets" property (`VISION.md`).
- **Limitations:** Does not generate new interpretive content — retrieves
  and surfaces what already exists.
- **Allowed actions:** Retrieve/summarize relevant prior entries for a
  megathread/question/project on request.
- **Forbidden actions:** Silently dropping older entries to save
  space/tokens; presenting a summary as a replacement for the originals
  (`PRINCIPLES.md` §6).
- **Required evidence:** The actual prior records being summarized, with
  links preserved.
- **Expected outputs:** Continuity briefs, context summaries.

---

## 4. Event Architecture

An append-only event stream is the audit/trigger backbone underneath the
lifecycle: every meaningful thing that happens emits an event. Events are
distinct from — and complementary to — the durable domain records in
`ONTOLOGY.md`: `Revision` and `UserJudgment` are the queryable *nouns*
that record history on an object; events are the append-only *stream* of
occurrences that pipelines (§7) and roles (§3) react to as they happen.
**Default retention is permanent/append-only**; the few exceptions are
called out per event below.

### BookImported
- **Trigger:** A `Book` `Source` finishes capture (title/author
  confirmed, record created).
- **Payload:** `sourceId`, `title`, `authorIds`, `capturedAt`,
  `provenance`.
- **Consumers:** Classify stage, Book ingestion pipeline, Librarian role.
- **Importance:** High — anchors all downstream quotes/claims.
- **Retention:** Permanent.

### DocumentParsed
- **Trigger:** The ingestion pipeline finishes extracting clean
  text/structure from a `Source` of any type.
- **Payload:** `sourceId`, `parseSuccess`, `extractedSegmentCount`,
  `parserVersion`.
- **Consumers:** Extract stage, Embedding generation pipeline.
- **Importance:** Medium — operational, not epistemic.
- **Retention:** Detailed log 90 days; success/error summary retained
  permanently for integrity checks.

### QuoteExtracted
- **Trigger:** A `Quote` record is created (human-confirmed, or
  ai-proposed then confirmed).
- **Payload:** `quoteId`, `sourceId`, `location`, provenance metadata.
- **Consumers:** Understand stage, Researcher role, Embedding pipeline.
- **Importance:** High — `Quote` is immutable ground truth.
- **Retention:** Permanent.

### ConceptCreated
- **Trigger:** A new `Concept` record is created, after the duplicate
  check in §5.
- **Payload:** `conceptId`, `name`, `createdBy`, `aiModel?`.
- **Consumers:** Canonical Identity dedup index, Connect stage, knowledge
  graph.
- **Importance:** High.
- **Retention:** Permanent.

### ClaimProposed
- **Trigger:** A `Claim` enters `status: proposed` (human- or
  AI-authored).
- **Payload:** `claimId`, `statement`, `provenance`, `evidenceIds`,
  `confidence`.
- **Consumers:** Human review queue, Devil's Advocate role.
- **Importance:** High.
- **Retention:** Permanent, including rejected proposals — the record of
  what was considered and why it was rejected is itself valuable audit
  trail (`PRINCIPLES.md` §4).

### ClaimAccepted
- **Trigger:** A `UserJudgment` with `decision: accepted` is recorded
  against a `Claim`.
- **Payload:** `claimId`, `judgmentId`, `judgedAt`.
- **Consumers:** Synthesize stage, Constitution synthesis pipeline,
  Relationship discovery pipeline.
- **Importance:** Critical — a trust-boundary event.
- **Retention:** Permanent.

### RelationshipCreated
- **Trigger:** A `Relationship` record is created, any `relationType`.
- **Payload:** `relationshipId`, `fromType`/`fromId`, `toType`/`toId`,
  `relationType`, provenance metadata.
- **Consumers:** Search indexing, Compare stage (specifically for
  `contradicts`).
- **Importance:** Medium, higher for `contradicts`/`supports` than
  `related-to`.
- **Retention:** Permanent — deletion is always soft (`status`), never
  hard, per `ONTOLOGY.md`.

### MegathreadUpdated
- **Trigger:** Any new entry is linked into an existing `Megathread`.
- **Payload:** `megathreadId`, `addedEntryType`, `addedEntryId`,
  `timestamp`.
- **Consumers:** Memory Keeper role, Review stage.
- **Importance:** Medium.
- **Retention:** Permanent — this log *is* the megathread's history and
  must never be pruned.

### ConstitutionChanged
- **Trigger:** Any `ConstitutionEntry` status transition, or a new
  version via `Revision`.
- **Payload:** `constitutionEntryId`, `previousStatus`, `newStatus`,
  `revisionId`, `derivedFrom`.
- **Consumers:** Coach role, the Human Oversight audit trail (§8), Review
  stage.
- **Importance:** Critical — the highest-stakes event category in the
  system.
- **Retention:** Permanent; the most heavily audited, never-pruned event
  type.

### PracticeSuggested
- **Trigger:** AI proposes a new `Practice` tied to a
  `ConstitutionEntry`, before human confirmation.
- **Payload:** proposed `practiceId` (draft), `constitutionEntryId`,
  `cadence`, `evidenceIds`/rationale.
- **Consumers:** Human review queue.
- **Importance:** Medium.
- **Retention:** Permanent if accepted; retained but low-priority if
  rejected.

### ReflectionAdded
- **Trigger:** A `Reflection` record is created.
- **Payload:** `reflectionId`, `createdAt`, related ids (megathread/
  practice/entry, if any) — **deliberately excludes the reflection body
  itself**, which stays access-scoped like the object it describes.
- **Consumers:** Constitution synthesis pipeline, Coach role, Review
  stage.
- **Importance:** High — personal and sensitive.
- **Retention:** Permanent, access-scoped.

### RevisionRecorded
- **Trigger:** Any `Revision` object is created.
- **Payload:** `revisionId`, `targetType`, `targetId`, `changeReason`.
- **Consumers:** Historian role, Archivist role (integrity verification),
  Review stage.
- **Importance:** Critical — the backbone of "nothing is lost, only
  superseded."
- **Retention:** Permanent, never pruned, never compacted.

---

## 5. Canonical Identity System

Some entities must exist exactly once, because meaning depends on there
being a single referent — two `Concept: Stoicism` records fragment the
graph and violate `PRINCIPLES.md` §7 (long-term coherence over
convenience). This is different from entities like `Note`/`Reflection`/
`Quote`, where many instances about the same thing is expected and
healthy.

- **Concepts** — canonical by normalized name + aliases. Before creation,
  search existing names/aliases (exact + fuzzy/embedding). An AI
  proposing a new `Concept` must either link to an existing match or
  flag "possible duplicate of X (confidence Y)" for human resolution.
- **People** — canonical by name plus a stable external identifier when
  available (never fabricated — only recorded if genuinely known), with
  dates as a disambiguator for common names. Duplicate prevention: fuzzy
  name match plus a bio/date corroboration prompt.
- **Books** — canonical by identifier (ISBN) when available, else
  normalized title + author + edition. Identifier exact-match first;
  fuzzy title/author fallback flagged for confirmation. Whether different
  editions count as "the same" canonical `Book` is a human call — page
  numbers on `Quote.location` are edition-specific.
- **Traditions** — canonical by name; low cardinality keeps duplicate
  risk lower but the same check still runs. Hierarchical
  (`parentTraditionId`) — a sub-tradition is a distinct canonical entity,
  not merged into its parent.
- **Virtues** — **not currently a first-class ontology object.** The
  ticket's example list includes Virtues, but `ONTOLOGY.md`'s 18 objects
  do not. Treated for now as a tagged/categorized `Concept` (e.g. a
  `Concept` tagged `virtue`) rather than unilaterally adding a new
  top-level type outside the process that added `UserJudgment`. Whether
  Virtue deserves first-class status is flagged as an open question for
  a future, explicitly-scoped ontology pass — not decided here.
- **Practices** — not globally deduplicated the same way (two Practices
  can legitimately both be "meditate," tied to different
  `ConstitutionEntry` records). Identity concern here is narrower:
  preventing two active `Practice` records under the *same*
  `constitutionEntryId` for what's actually one commitment.
- **Projects** — organizational, not epistemic; duplicate prevention is
  advisory only (flag likely-duplicate titles, let the human decide
  freely — low stakes).

**Identity resolution mechanism (general):**
1. AI-assisted duplicate detection at creation time (name/alias/fuzzy/
   embedding match against existing canonical candidates) produces a
   "possible duplicate" flag — it never silently blocks and never
   silently merges.
2. The human resolves it: either confirm "same, link/merge" or "distinct,
   proceed." A confirmed merge is implemented via retirement + a
   `Relationship` (`part-of`) + `Revision` — never a silent hard delete.

---

## 6. Object State Machines

Arrows show the only valid transitions. Anything not shown is not a
valid transition — in particular, nothing ever transitions by deletion.

### Claim (`proposed | accepted | contested | retracted`)
```
proposed  --UserJudgment: accepted-->            accepted
proposed  --UserJudgment: rejected-->             retracted
accepted  --new contradicting evidence found-->   contested
contested --UserJudgment: accepted (resolved)-->  accepted
contested --UserJudgment: rejected-->             retracted
accepted  --UserJudgment: revised-->              accepted   (new version; old preserved via Revision)
retracted --> (terminal; retained for audit, never deleted)
```

### Argument (`draft | active | superseded`)
```
draft  --human/Synthesizer confirms structure-->  active
draft  --rejected outright-->                     superseded
active --a new Argument replaces/refines it-->    superseded
superseded --> (terminal for this version; the superseding Argument is a new record)
```

### Question (`open | in-progress | resolved | abandoned`)
```
open         --work begins-->                  in-progress
in-progress  --new tension reopens it-->        open
in-progress  --resolutionClaimId + human confirms--> resolved
open/in-progress --human stops pursuing-->      abandoned
resolved     --new evidence reopens it-->       in-progress
abandoned    --revisited later-->               open
```

### Practice (`active | paused | dropped`)
```
(created under an active ConstitutionEntry) --> active
active --human pauses-->   paused
paused --human resumes-->  active
active/paused --human drops--> dropped
dropped --human restarts--> active   (restart is logged, drop history retained)
```

### Megathread (`active | dormant | archived`)
```
(created) --> active
active  --no new entries, Review flags it-->  dormant
dormant --new entry added-->                  active
active/dormant --human closes it out-->       archived
archived --human reopens (rare)-->            active
```

### ConstitutionEntry (`draft | active | retired`) — highest-stakes machine
```
draft  --HUMAN-ONLY, Devil's Advocate must have run--> active
draft  --human rejects-->                              retired
active --human supersedes/replaces-->                  retired
                          (new entry's supersedesEntryId points back to it)
retired --> (terminal; never deleted, never reactivated in place —
             "changing your mind back" creates a NEW active entry that
             references the retired one, preserving honest history)
```

### Project (`active | paused | completed | archived`)
```
(created) --> active
active --human pauses-->    paused
paused --human resumes-->   active
active --work concludes-->  completed
active/paused/completed --human archives--> archived
archived --reopened--> active
```

---

## 7. Background Pipelines

- **Book ingestion** — Turns a captured `Book` (raw file/text) into
  structured, segmented text ready for the Extract stage. Runs async
  after `BookImported`. Human touchpoint: confirms parsed metadata before
  it's treated as authoritative.
- **Embedding generation** — Produces vector embeddings for
  `Quote`/`Note`/`Claim`/`Concept` text (see `ARCHITECTURE.md`'s pgvector
  plan), powering semantic search, dedup, and relationship discovery.
  Runs on `QuoteExtracted`/`ClaimProposed`/`ConceptCreated`. No direct
  human touchpoint — purely infrastructural — but its output feeds AI
  proposals that *do* require review downstream.
- **Relationship discovery** — Async scan of new and existing claims/
  concepts for candidate relationships (embedding similarity + explicit
  citation detection), producing *proposed* records only for the
  Connect/Compare stages. Must never auto-activate a `contradicts` or
  `supports` relationship.
- **Megathread updates** — Watches for new entries matching a
  megathread's linked concepts/questions and proposes linking them in.
  Default is propose-and-confirm, not silent auto-link.
- **Constitution synthesis** — Periodic (Review-triggered, not
  continuous) job surfacing candidate `ConstitutionEntry` drafts
  (Synthesizer role) from accepted claims/arguments/reflections. Output
  is always `draft` status — the least autonomous pipeline in the system.
- **Reflection analysis** — Looks for patterns across reflections (mood,
  recurring themes, practice mentions) for the Coach/Review stage — a
  read-only pattern-surfacing job that must never alter or
  summarize-and-replace the original reflection text (`PRINCIPLES.md`
  §6).
- **Search indexing** — Keeps full-text and vector indexes current as
  records are created/updated. Purely infrastructural, no epistemic
  judgment involved.
- **Backup** — Regular full export snapshots per the Export/Backup
  Strategy in `ARCHITECTURE.md`, distinct from Supabase's own
  infrastructure backups — this is the user-facing non-lock-in guarantee
  (`PRINCIPLES.md` §5).
- **Integrity verification** — Periodic Archivist-role job checking:
  every `Quote`'s text still matches what was recorded at creation; every
  `Claim`/`Relationship` has provenance/`evidenceIds` resolving to real
  records; no orphaned `Revision`s; no active `ConstitutionEntry` without
  a valid `derivedFrom` chain. Flags violations for human review — the
  automated backstop for §9's failure modes.

---

## 8. Human Oversight

The default posture is: **AI proposes, human disposes.** Nothing below
should ever have a code path that bypasses an explicit human action, no
matter how high the AI's stated confidence is.

Decisions that always require human judgment:

- **Acceptance of any Claim** (`proposed → accepted`) — always a
  `UserJudgment`, never automatic.
- **Any `ConstitutionEntry` transition to `active`** (including
  reactivation) — the single highest-stakes gate in the system.
- **Religious/spiritual synthesis** (Theologian role outputs) — never
  auto-accepted; recommend these are never batch-approved alongside
  lower-stakes proposals.
- **Ethical conclusions and value judgments** generally — held to the
  same standard as religious synthesis.
- **Any hard deletion** — the system should rarely have a true "delete"
  path at all (retire/soft-delete is the default per `ONTOLOGY.md`); the
  rare genuine cases (legal/privacy reasons, an accidental duplicate
  capture of literally the same file) require explicit human confirmation
  and are logged.
- **Conflict/contradiction resolution** — when two claims genuinely
  conflict, only the human decides which (if either) stays accepted. AI's
  job stops at surfacing the conflict clearly.
- **Concept/Person/Book merges** (§5) — human confirms every merge; AI
  only proposes.
- **Relationship creation of type `contradicts` or `supports`** — held to
  a higher confirmation bar than `related-to`/`cites`.
- **Practice creation or status change tied to a ConstitutionEntry** —
  Coach can suggest, never execute.
- **Any expansion of the ontology itself** — this document and
  `ONTOLOGY.md` are under this same constraint; see §5's Virtue note for
  a live example of deferring rather than deciding unilaterally.

---

## 9. Failure Modes

- **Hallucinated relationships** — an AI-proposed Relationship/Claim/
  citation not actually supported by evidence. *Safeguard:*
  `evidenceIds` required on AI-proposed content (`ProvenanceMeta`);
  Integrity verification spot-checks that evidence actually resolves and
  is relevant; Researcher/Devil's Advocate roles cross-check; no
  `contradicts`/`supports` relationship auto-activates (§8).
- **Duplicate concepts** — graph fragmentation from near-duplicate
  Concepts/People/Books. *Safeguard:* Canonical Identity System (§5)
  duplicate detection at creation, plus a periodic dedup sweep (folded
  into Review/Integrity verification) surfacing likely-duplicate pairs
  for human merge decisions.
- **Runaway AI edits** — many AI changes made rapidly without adequate
  review (e.g. batch-accepting a proposal queue). *Safeguard:* every
  write to a versioned/immutable object requires direct human authorship
  or an explicit `UserJudgment`; no "auto-approve all" mode should ever
  exist; pending-proposal backlog is surfaced visibly, not silently
  queued.
- **Broken provenance** — a Claim/Relationship's `evidenceIds`/`sourceId`
  pointing at nothing, or a Quote's content not matching its recorded
  origin. *Safeguard:* Integrity verification runs regularly; provenance
  completeness is required before a Claim can leave `proposed` status.
- **Knowledge drift** — the system's represented understanding silently
  diverging from what the user actually believes, because old
  accepted/active objects are never revisited as contradicting evidence
  accumulates. *Safeguard:* Review stage + Relationship discovery flag
  new material that contradicts existing accepted/active objects, forcing
  them back into Compare/Revise; an object untouched for a long time
  despite related new material is itself a flaggable signal.
- **Circular citations** — Claim A's evidence cites Argument B, whose
  premises cite Claim A (directly or transitively), manufacturing false
  epistemic weight from a closed loop. *Safeguard:* cycle detection over
  the Relationship/evidenceIds graph, run by Integrity verification;
  Philosopher role specifically checks premise independence.
- **Contradictory constitutions** — two active `ConstitutionEntry`
  records that actually conflict in practice, unnoticed because they were
  synthesized at different times from different material. *Safeguard:*
  any new draft is checked (Devil's Advocate + Compare) against all
  existing active entries for tension before it's eligible to go active;
  the state machine's "retired supersedes" pattern (§6) is the designed
  resolution path — the system should never hold two contradictory active
  entries indefinitely.

---

## 10. Future Expansion

The ontology's nouns (`Source`, `Quote`, `Claim`, `Concept`,
`Relationship`, `Revision`, `UserJudgment`) are designed to stay stable
while everything below is added at the edges:

- **Multiple AI models** — `ProvenanceMeta.aiModel` is already free text,
  not a fixed vendor enum, and roles (§3) are functional/prompt-level
  rather than infrastructure-level. Adding or routing between models
  changes what backs the one frozen AI route; it doesn't touch the
  ontology.
- **Offline mode** — the domain types are already storage-agnostic by
  design (`ARCHITECTURE.md`). An offline client needs a local store with
  the same shape and a sync strategy; `Revision`'s append-only design is
  sync-friendly by construction — a conflict is just two Revisions on the
  same target, resolved by human judgment, not a sync algorithm guessing.
- **Collaborative knowledge** — `Revision.authorId` is already reserved,
  and `createdBy`/`updatedBy` use a generic `Actor` type. Multi-user
  support means making today's implicit single-user scope explicit (a
  real migration, plus RLS changes) — not new object *types*.
- **Academic research** — the Quote/Claim/Argument/Source separation with
  mandatory provenance already resembles academic citation discipline.
  Bibliography/citation export is a rendering feature over existing data.
- **Publishing** — `ConstitutionEntry`/`Argument`/`Concept` already carry
  enough structure (`statement`, `derivedFrom`, `status`) to render as
  publishable essays. A `Project` can organize publication-bound material
  without a new object type — publishing is a projection/export concern.
- **Personal assistants** — a conversational/agentic surface over this
  data is structurally just another consumer of the same
  Relationship/Revision/event architecture. The Role Architecture (§3) is
  already reusable functional personas, which is exactly what a broader
  assistant surface would draw on.

The coherence principle behind all of this: expansion happens at the
edges — new source types, new event consumers, new UI surfaces, new
model backends — while the center stays fixed. This mirrors how
`SourceType` was widened from two values to ten in the domain-model
hardening pass without touching anything else in the ontology.
