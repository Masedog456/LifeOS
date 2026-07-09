# Pilot: Gospel of Thomas, Saying 37

> **PROVISIONAL — DESIGN EXERCISE, NOT AN IMPLEMENTATION.** This document
> manually simulates one pass through the LifeOS knowledge lifecycle
> against a real, small, realistic use case, to stress-test
> `COGNITIVE_ARCHITECTURE.md`, `ONTOLOGY.md`, and `types/lifeos.ts` before
> any database implementation begins. Every "record" below is hand-written
> pseudo-data illustrating the *shape* the ontology would produce — none
> of it exists in a database, no code was written, and nothing here
> implies any of these interpretations are correct or final. All of it is
> subject to the same human-oversight rules (`COGNITIVE_ARCHITECTURE.md`
> §8) that would apply if this were real.

## Scenario

- **Source:** *The Gospel of Thomas* — a Coptic sayings-gospel from the
  Nag Hammadi library, traditionally (pseudonymously) attributed to
  "Didymos Judas Thomas."
- **Focus Question:** "What does Saying 37 reveal about spiritual
  nakedness, shame, perception, and realization?"

**A provenance note before anything else:** the text of Saying 37 used
below is recalled from training data (commonly cited translations, e.g.
Lambdin's), **not read from an uploaded `Source` in this system.** Per
`AI_AGENT_RULES.md` rule 2 ("never invent citations"), this is flagged
explicitly rather than presented as verified. In a real LifeOS session,
this text would need to be captured from an actual book/PDF/webpage
before being treated as a trustworthy `Quote` — this pilot's own Capture
stage (below) is deliberately honest about that gap, because it's itself
a useful stress-test finding (see Part 3).

The saying, as recalled:

> His disciples said, "When will you become revealed to us, and when
> shall we see you?" Jesus said, "When you disrobe without being
> ashamed, and take up your garments and place them under your feet like
> little children and tread on them, then [you will see] the son of the
> living one, and you will not be afraid."

---

## Part 1 — Lifecycle Walkthrough

Twelve stages, walked in order, with content-type tags on every claim:
**[SOURCE TEXT]**, **[SUMMARY]**, **[INTERPRETATION — AI-PROPOSED]**,
**[AI-PROPOSED]**, or **[HUMAN JUDGMENT — PLACEHOLDER]** (meaning: in a
real session, a human — not me writing this pilot — would make this
call; what's shown is illustrative only). Object ids reference the full
records in Part 2 (Object Gallery).

### 1. Capture

The user pastes the saying's text (from a physical book or a trusted
digital edition) into LifeOS, or photographs/scans the page. This
creates `src_001` (the Book, if not already captured) and a raw capture
event pointing at it.

**[AI-PROPOSED]** metadata suggestion: title "The Gospel of Thomas",
`SourceType: book`, tags `["gnostic", "nag-hammadi", "sayings-gospel"]`.
**[HUMAN JUDGMENT — PLACEHOLDER]** the human confirms this metadata
before it's trusted (Capture success criteria, `COGNITIVE_ARCHITECTURE.md`
§2).

*Stress-test note (flagged here, discussed in Part 3):* in this pilot, I
(the AI) am simultaneously the one *recalling* the text and the one
*capturing* it — a conflation that wouldn't happen in a real session
where Capture starts from an actual external artifact. I'm flagging that
conflation rather than pretending it isn't there.

### 2. Extract

The disciples'-question-and-answer unit is extracted as one `Quote`
(`qte_001`) — **[SOURCE TEXT]**, verbatim, `location: "Saying 37"`.

### 3. Classify

**[AI-PROPOSED]** tags on `qte_001`: `nakedness`, `shame`,
`perception`, `son-of-the-living-one`, `childlikeness`. **[AI-PROPOSED]**
candidate `Concept` links (weak, pending Connect): Spiritual Nakedness,
Gnosis, Shame, Childlikeness.

*Stress-test note:* for a single saying, this stage produced almost
nothing that Extract didn't already imply — see Part 3, "which stages
felt redundant."

### 4. Understand

Candidate claims are drafted from the quote:

- `clm_001` **[INTERPRETATION — AI-PROPOSED, low inference]**: "Saying 37
  presents nakedness-without-shame as a precondition for perceiving 'the
  son of the living one.'" — nearly a paraphrase of the text itself.
- `clm_002` **[INTERPRETATION — AI-PROPOSED, low inference]**: "The
  disciples' question frames revelation as a perceptual/epistemic event
  ('when shall we see you'), not only a future physical appearance."
- `clm_003` **[INTERPRETATION — AI-PROPOSED, high inference]**: "Saying
  37 depicts the human body itself as a garment to be discarded,
  consistent with a body-negative Gnostic dualism."

`clm_001` and `clm_002` stay close to the text; `clm_003` is a much
larger interpretive leap — exactly the kind of claim `PRINCIPLES.md` §6
requires be kept visibly distinct from the quote it's built on.

### 5. Connect

`clm_001`–`clm_003` are linked to `con_001`–`con_004` (see Part 2) via
`related-to`/`derived-from` relationships. `src_001` is linked to
`person_001` (Thomas, traditional attribution) — **[AI-PROPOSED]**,
flagged for human confirmation given the redundancy noted in Part 3.

### 6. Compare

Pushing on `clm_003` surfaces a genuine tension: is "trampling garments"
really body-rejection, or is it echoing Genesis 2:25 ("naked and
unashamed") — a return to *innocence*, not a rejection of embodiment?
This produces:

- `clm_004` **[INTERPRETATION — AI-PROPOSED, comparative]**: "The
  trampling of garments 'like little children' evokes a return to
  prelapsarian innocence, paralleling Genesis 2:25, rather than a
  rejection of embodiment."
- `rel_001`: a `contradicts` `Relationship` between `clm_003` and
  `clm_004` — **[AI-PROPOSED]**, held to the higher confirmation bar
  `COGNITIVE_ARCHITECTURE.md` §8 requires for `contradicts`/`supports`.

Per Compare's own success criteria, this tension is **preserved, not
resolved** — both claims stay at `status: proposed` pending human review.

### 7. Synthesize

Two competing `Argument`s are drafted:

- `arg_001` (Synthesizer role) — concludes `clm_003`, premises citing
  `clm_001` plus an inline (not-yet-promoted) premise about Gnostic
  cosmology generally valuing spirit over flesh.
- `arg_002` (Devil's Advocate role, explicitly invoked because `arg_001`
  was about to go unchallenged — `COGNITIVE_ARCHITECTURE.md` §3) —
  concludes `clm_004`, premises citing `clm_001` plus the Genesis 2:25
  parallel. `arg_001.counterArgumentIds` and `arg_002.counterArgumentIds`
  reference each other.

Both stay `status: draft`. **No `ConstitutionEntry` may be synthesized
from either until this tension is addressed by a human** (§8).

### 8. Reflect

**[HUMAN JUDGMENT — PLACEHOLDER / ILLUSTRATIVE ONLY — NOT A REAL
REFLECTION]** — `refl_001` is a stand-in for what a real user's personal,
first-person reflection would look like. I am writing illustrative
placeholder text here to show the *shape* of the record; per
`AI_AGENT_RULES.md`, an AI must never author a real `Reflection` on the
user's behalf, and this placeholder must not be mistaken for one:

> *(placeholder)* "The idea that shame is what stands between me and
> being seen clearly — by myself, not just by God — lands. I notice I
> perform composure. I don't know yet if 'trampling the garment' means
> discarding my body's dignity or discarding the persona I've built. I
> want to sit with clm_003 vs. clm_004 rather than pick one today."

### 9. Revise

The Genesis parallel from Compare prompts a `Revision` (`rev_001`) to
`con_003`'s description — its original definition assumed shame was
purely negative/obstructive; the revision broadens it to include shame as
*possibly protective*, per the Genesis reading. **[AI-PROPOSED]** revision,
pending confirmation — see Part 2 for the actual diff.

### 10. Constitution

`ce_001` is drafted (Synthesizer role): a candidate principle about
relating to shame and self-perception. **Status stays `draft`.** Per §6
and §8, it cannot go `active` until (a) the `clm_003`/`clm_004` tension
is resolved or explicitly held-as-open by the human, and (b) a Devil's
Advocate pass has run against the *entry itself*, not just the
underlying claims. Neither has happened yet in this pilot — which is the
correct, intended outcome, not a gap.

### 11. Practice

**No real `Practice` record is created**, because `ce_001` never reached
`active`. This is the state machine (§6) working as designed: `Practice`
requires a `constitutionEntryId`, and nothing in the ontology should let
a practice attach to a draft, unconfirmed principle. What Part 2 shows
instead is a `PracticeSuggested` **event** — a proposal only, exactly
matching the event architecture's design (§4) for this situation. This
distinction turned out to matter more than expected — see Part 3.

### 12. Review

Nothing is old enough yet for a real Review pass (this pilot is a single
session), but the mechanism is clear: `q_001` stays `status:
in-progress`; `mt_001` (the Megathread this feeds) stays `active`; and a
future Review would flag `clm_003`/`clm_004`'s unresolved contradiction
and `ce_001`'s stuck-in-draft state as exactly the kind of thing Review
exists to surface, per `COGNITIVE_ARCHITECTURE.md` §2's Review success
criteria.

---

## Part 2 — Object Gallery

All 13 requested object types, as they'd look under the current
`types/lifeos.ts`. Field values are illustrative; ids are short-form for
readability.

### Source
```
{
  id: "src_001",
  type: "book",
  title: "The Gospel of Thomas",
  capturedAt: "2026-07-09T00:00:00Z",
  provenance: "human",
  authorIds: ["person_001"],   // see friction note below
  identifier: "NHC II,2",       // Nag Hammadi Codex reference, not an ISBN
  description: "Coptic Gnostic sayings gospel, Nag Hammadi library.",
  tags: ["gnostic", "nag-hammadi", "sayings-gospel", "early-christianity"]
}
```
**[SOURCE-LEVEL METADATA]** — mostly uncontroversial, except: this is
typed as a `Book`, and `Book.authorIds` is currently **required**
(`ID[]`, not optional). The Gospel of Thomas has no confirmed single
human author — "Thomas" is a traditional, pseudonymous attribution, not a
fact. Forcing `authorIds` to be non-empty here means either (a) recording
a contested attribution as if it were settled, or (b) leaving the field
technically satisfied with an id whose corresponding `Person` record must
itself carry heavy caveats. Neither is clean. See Part 4.

### Quote
```
{
  id: "qte_001",
  sourceId: "src_001",
  text: "His disciples said, \"When will you become revealed to us, and when shall we see you?\" Jesus said, \"When you disrobe without being ashamed, and take up your garments and place them under your feet like little children and tread on them, then [you will see] the son of the living one, and you will not be afraid.\"",
  location: "Saying 37",
  tags: ["nakedness", "shame", "son-of-the-living-one", "childlikeness"]
}
```
**[SOURCE TEXT]** — but see the provenance note at the top of this
document: recalled from training data, not captured from an actual
uploaded source. In a real session this `Quote` would not be trustworthy
until verified against the real artifact.

### Claim
```
{
  id: "clm_003",
  statement: "Saying 37 depicts the human body itself as a garment to be discarded, consistent with a body-negative Gnostic dualism.",
  provenance: "ai-proposed",
  status: "contested",
  quoteId: "qte_001",
  createdBy: "ai",
  updatedBy: "ai",
  aiModel: "claude-sonnet-5",
  confidence: 0.45,
  evidenceIds: ["qte_001"],
  tags: ["gnostic-dualism", "embodiment"]
}
```
**[INTERPRETATION — AI-PROPOSED]** — the highest-inference claim in this
pilot, deliberately chosen to exercise `status: contested` and the
`ProvenanceMeta` fields.

### Concept
```
{
  id: "con_003",
  name: "Shame as Perceptual Obstruction",
  description: "The idea, drawn from Saying 37, that shame (specifically about being seen/known) is what blocks clear perception of oneself and of ultimate reality — 'disrobing without shame' as a precondition for 'seeing.'",
  version: 2,   // see rev_001
  createdBy: "ai",
  updatedBy: "ai",
  aiModel: "claude-sonnet-5",
  confidence: 0.6,
  tags: ["shame", "perception"]
}
```
**[SUMMARY + INTERPRETATION — AI-PROPOSED]** — a definition synthesized
from the quote, already at `version: 2` after `rev_001` (Part 1, Revise).

### Question
```
{
  id: "q_001",
  text: "What does Saying 37 reveal about spiritual nakedness, shame, perception, and realization?",
  status: "in-progress",
  relatedConceptIds: ["con_001", "con_002", "con_003", "con_004"],
  tags: ["gospel-of-thomas", "saying-37"]
}
```
**[HUMAN-AUTHORED FRAMING]** — this is the question exactly as the
Product Owner posed it for this pilot.

### Argument
```
{
  id: "arg_002",
  conclusionClaimId: "clm_004",
  premises: [
    { claimId: "clm_001" },
    { statement: "Genesis 2:25 — 'the man and his wife were both naked, and were not ashamed' — establishes a canonical image of unashamed nakedness as prelapsarian innocence, not body-rejection." }
  ],
  status: "draft",
  counterArgumentIds: ["arg_001"],
  tags: ["devils-advocate", "comparative"]
}
```
**[INTERPRETATION — AI-PROPOSED, Devil's Advocate role]** — note the
second premise is an inline `statement`, not a `claimId` — it cites a
piece of comparative-religion knowledge that was never separately
proposed as its own `Claim`. See Part 3/4 on whether that's the right
call.

### Relationship
```
{
  id: "rel_001",
  fromType: "Claim", fromId: "clm_003",
  toType: "Claim",   toId: "clm_004",
  relationType: "contradicts",
  status: "active",
  createdBy: "ai",
  updatedBy: "ai",
  aiModel: "claude-sonnet-5",
  confidence: 0.7,
  note: "Both claims interpret the same passage's body/garment imagery in opposite directions."
}
```
**[AI-PROPOSED]** — held to the higher confirmation bar §8 requires for
`contradicts`; not yet human-confirmed.

### Megathread
```
{
  id: "mt_001",
  title: "Gnostic Anthropology & the Body",
  status: "active",
  description: "Long-running thread on how Gnostic/Thomasine texts treat embodiment, shame, and perception — Saying 37 is the first entry.",
  relatedConceptIds: ["con_001", "con_003"],
  relatedQuestionIds: ["q_001"]
}
```
**[ORGANIZATIONAL]** — this pilot is deliberately framed as *one entry*
into a longer-running thread, not a self-contained one-off, to test the
Megathread object honestly.

### ConstitutionEntry
```
{
  id: "ce_001",
  statement: "I aim to notice where shame makes me perform instead of be seen — and treat that noticing itself as the 'disrobing,' not a verdict on my body or worth.",
  status: "draft",
  derivedFrom: ["clm_001", "refl_001"],
  version: 1,
  createdBy: "ai",
  updatedBy: "ai",
  aiModel: "claude-sonnet-5",
  confidence: 0.4,
  tags: ["shame", "self-perception"]
}
```
**[INTERPRETATION — AI-PROPOSED DRAFT]** — explicitly **not active**.
Cannot become active until the `clm_003`/`clm_004` tension is addressed
and a Devil's Advocate pass runs against this entry specifically (§8).

### Practice
No real `Practice` record exists (see Part 1, stage 11). What would
exist instead, today, is a proposal:
```
// PracticeSuggested event payload, NOT a Practice record:
{
  proposedTitle: "Weekly check-in: where did I perform instead of let myself be seen?",
  constitutionEntryId: "ce_001",   // still draft — this is why no real Practice exists yet
  cadence: "weekly",
  rationale: "Directly operationalizes ce_001 once (if) it goes active.",
  evidenceIds: ["ce_001"]
}
```
**[AI-PROPOSED, ILLUSTRATIVE]** — shown to satisfy the request to
exhibit `Practice`, while being honest that the state machine correctly
prevents a real one from existing yet.

### Reflection
```
{
  id: "refl_001",
  body: "(placeholder — see Part 1, stage 8: this must be human-authored in a real session)",
  createdAt: "2026-07-09T00:00:00Z",
  relatedMegathreadId: "mt_001"
}
```
**[ILLUSTRATIVE PLACEHOLDER — NOT A REAL HUMAN REFLECTION]** — full text
in Part 1. Flagged as heavily as possible here because this is the one
object type where an AI standing in for the human, even for illustration,
is closest to violating `AI_AGENT_RULES.md` rule 1's spirit.

### Revision
```
{
  id: "rev_001",
  targetType: "Concept",
  targetId: "con_003",
  previousValue: { description: "The idea that shame blocks perception of reality; something to be shed.", version: 1 },
  newValue: { description: "The idea, drawn from Saying 37, that shame (specifically about being seen/known) is what blocks clear perception of oneself and of ultimate reality — 'disrobing without shame' as a precondition for 'seeing.' (Broadened per clm_004: shame may also be read as protective, per the Genesis parallel, not purely obstructive.)", version: 2 },
  changedAt: "2026-07-09T00:10:00Z",
  changeReason: { actor: "ai-proposed", note: "Prompted by arg_002's Genesis 2:25 parallel surfaced during Compare." }
}
```
**[AI-PROPOSED REVISION]** — pending human confirmation like everything
else `ai-proposed` in this pilot.

### UserJudgment
```
[
  {
    id: "uj_001",
    targetType: "Claim", targetId: "clm_001",
    decision: "accepted",
    note: "Close paraphrase of the text, low interpretive risk.",
    judgedAt: "2026-07-09T00:05:00Z"
  },
  {
    id: "uj_002",
    targetType: "Claim", targetId: "clm_003",
    decision: "questioned",
    note: "Not ready to accept the body-negative reading until clm_004's Genesis parallel is weighed properly — want to read more comparative scholarship first.",
    judgedAt: "2026-07-09T00:12:00Z"
  }
]
```
**[HUMAN JUDGMENT — PLACEHOLDER]** — these are the two decisions a real
human would plausibly make; written here as illustration of the object
shape, not as an actual recorded verdict.

---

## Part 3 — Stress Test

**Which objects worked well?**
`Quote`, `Claim`, `Relationship`, and `Revision` all did real work with
no friction. Keeping `Quote.text` untouchable and routing every
correction through `Revision`/new records, rather than edits, made the
`clm_003` vs. `clm_004` tension easy to represent honestly — nothing had
to be silently resolved to fit the schema. `UserJudgment` as a distinct
object (rather than a status field on `Claim`) also earned its keep: it
let `clm_003` carry both a *status* (`contested`) and a *documented human
reason* (`uj_002`) for not yet accepting it — losing either one would
have lost information.

**Which objects felt awkward?**
- `Book.authorIds` being required broke immediately on a pseudonymous
  ancient text — this wasn't a contrived edge case, it's *the normal
  case* for the kind of source material `VISION.md` centers (scripture,
  classical philosophy, anonymous tradition).
- `ArgumentPremise` mixing `claimId` and inline `statement` worked, but
  left an unresolved question: when does an inline premise (like the
  Genesis 2:25 parallel in `arg_002`) get promoted to its own `Claim`?
  Nothing in the ontology forces or forbids this, so two similar
  arguments could end up representing their premises completely
  differently depending on which AI role drafted them.
- `Source.authorIds` and a possible `Relationship(relationType:
  "authored-by")` can both express "Thomas wrote this" — the ontology
  doesn't say which is canonical, and I found myself able to justify
  using either.

**Which lifecycle stages felt redundant?**
Classify added almost nothing beyond what Extract already implied for a
single saying — the tags it "produced" were really just Extract's output
restated. Compare and Synthesize also blurred together in practice: the
moment `clm_003`/`clm_004` tension was found (Compare), the impulse to
draft `arg_001`/`arg_002` (Synthesize) was immediate and hard to treat as
a genuinely separate step rather than the same act of thinking continued.

**Which AI roles were useful?**
Theologian (framing the stakes of a religious/spiritual claim honestly),
Devil's Advocate (concretely produced `arg_002`/`clm_004` — without it,
`clm_003` would likely have gone unchallenged), Researcher (surfacing the
Genesis parallel as evidence), and Philosopher (implicitly, in checking
that `arg_001`'s and `arg_002`'s premises were actually independent, not
circular) were all doing real, distinguishable work.

**Which roles were unnecessary here?**
Coach (nothing to coach — no active `Practice` existed), Librarian (its
job collapsed into Classify, which itself was thin), and Memory Keeper
(a single-session, single-saying pilot has no cross-session continuity to
keep). None of these are *bad* roles — they simply weren't exercised by
a pilot this small. A multi-book, multi-session pilot would very likely
light them up.

**What would break at 100 books?**
- **Human review volume.** This one saying alone produced 3 claims, 2
  arguments, 1 contradicting relationship, and 1 draft constitution entry
  awaiting human judgment. At 100 books, the `UserJudgment` queue implied
  by "AI proposes, human disposes" (`COGNITIVE_ARCHITECTURE.md` §8) is
  not a UI detail — it's the central bottleneck. This confirms the
  cognitive architecture's own self-critique from the previous pass ("AI
  proposes, human disposes... does not scale" was flagged there as an
  open question; this pilot makes it concrete).
- **`confidence` is still not doing any real work.** I assigned numbers
  (`0.45`, `0.6`, `0.7`) above by feel, with no defined calibration. At
  scale, an undefined confidence field is actively dangerous if a UI ever
  uses it for triage, because it will look meaningful without being
  meaningful.
- **Canonical identity collisions.** `con_003` ("Shame as Perceptual
  Obstruction") is exactly the kind of concept that would independently
  arise from a dozen unrelated books (Stoic texts on shame, psychology
  books, other religious texts). The dedup mechanism in `ONTOLOGY.md` §5
  is sound in principle but untested at any real volume here.
- **Megathread growth.** `mt_001` has one entry today. A real "Gnostic
  Anthropology & the Body" megathread across 100 books could have
  hundreds — the Memory Keeper role exists precisely for this, but this
  pilot didn't stress it enough to know if summarization-without-
  replacing-originals (`PRINCIPLES.md` §6) actually holds up at that
  size.

**What would be painful in the UI?**
- Telling `clm_001` (near-paraphrase) apart from `clm_003` (large
  interpretive leap) at a glance — both are just "a Claim" with a
  `confidence` number that, per above, doesn't yet mean anything
  reliable.
- Reviewing `arg_001` vs. `arg_002` side-by-side as genuinely competing
  arguments, rather than one being buried as a "related item" under the
  other.
- Seeing `con_003`'s `Revision` history (`rev_001`) without it reading as
  clutter next to the current definition.
- Knowing, at a glance, that `ce_001` is blocked from going active and
  *why* — the state machine enforces this correctly, but nothing about
  the object itself surfaces "waiting on: resolve clm_003 vs clm_004,
  then run Devil's Advocate" as a checklist a human could act on.

---

## Part 4 — Recommended Changes

No existing doc was modified to produce these — they're proposals for a
future, explicitly-scoped pass, consistent with how `UserJudgment` and
`SourceType` were added in prior sessions.

### `types/lifeos.ts`
- Make `Book.authorIds` optional, and consider adding an
  `authorAttribution?: "confirmed" | "traditional" | "disputed" |
  "anonymous"` field (on `Source` or `Book`) so pseudonymous/anonymous
  works can be represented honestly instead of forcing a contested
  attribution into a required array.
- No change recommended to `ArgumentPremise` itself (see below — this is
  a process/documentation fix, not a type fix).

### `ONTOLOGY.md`
- Add a stated precedence rule: **structural fields (`Source.authorIds`,
  `Claim.sourceId`, etc.) are canonical for well-known, low-ambiguity
  facts; `Relationship` is for everything else** (contested, discovered,
  or cross-cutting connections). This pilot found itself able to justify
  either for authorship — the ontology should just say which one wins,
  to prevent the same fact being represented two inconsistent ways across
  different records.
- Document a rule for `ArgumentPremise`: an inline `statement` premise
  citing general/comparative knowledge (like `arg_002`'s Genesis
  reference) is acceptable at draft time, but should be promoted to a
  real `Claim` before the `Argument` can leave `draft` status — so every
  *active* argument's premises are uniformly evidence-backed and
  independently reviewable, not a mix of formal and informal.
- Revisit the Book authorship example above once the type change lands.

### `COGNITIVE_ARCHITECTURE.md`
- Amend the Knowledge Lifecycle note to say explicitly that **Classify
  may collapse into Extract for small captures** (a single saying, a
  short quote) and is only a meaningfully separate step for large
  ingestions (a whole book) — rather than presenting all twelve stages as
  always-equal-weight, discrete steps.
- Add a concrete worked note under §8 (Human Oversight) acknowledging
  what this pilot demonstrated numerically: one saying produced enough
  pending human judgments to make review-queue *design* (not just the
  principle "a human must decide") a first-class concern — pointing at
  the previous self-critique's "trust-tiering design spike" recommendation
  as the next real design task, not implementation.
- Add a short note to the `Practice` lifecycle stage description
  confirming, based on this pilot, that "no `Practice` record until its
  `ConstitutionEntry` is active" is the correct, intended reading of the
  state machine (§6) — this was ambiguous before running the pilot and is
  no longer ambiguous now.

### `ARCHITECTURE.md`
- Flag `confidence` explicitly as **not yet calibrated** in the future
  Supabase/AI pipeline notes — recommend it not be used for any UI
  sorting/triage/auto-filtering until a real calibration approach is
  defined, echoing the previous self-critique but now grounded in an
  actual example where the numbers were assigned "by feel."
- Add a note to the future ingestion pipeline section: `Book.authorIds`
  requiring a value will need to be resolved (per the type change above)
  before ancient/anonymous/pseudonymous texts — core to `VISION.md`'s
  stated scope — can be ingested cleanly.

---

## Summary

This pilot did what it was meant to do: it found real friction
(`Book.authorIds`, the `ArgumentPremise` promotion question, the
authorship dual-representation question) and real validation (`Quote`,
`Claim`, `Relationship`, `Revision`, `UserJudgment`, and the
`ConstitutionEntry`/`Practice` state-machine gate all held up under an
actual religious/spiritual interpretive question — arguably the hardest
case in `VISION.md`'s stated scope, not the easiest). None of the
friction found here is severe enough to suggest the ontology's center is
wrong; all of it is the kind of thing worth fixing in a small, targeted
pass before committing to a database schema.
