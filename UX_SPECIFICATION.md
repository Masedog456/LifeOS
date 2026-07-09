# LifeOS UX Specification — MVP

> **PROVISIONAL — PRODUCT DESIGN FREEZE DELIVERABLE.** This is the
> interaction blueprint for the LifeOS MVP, not wireframes, not code, not
> an implementation plan. It deliberately scopes the entire product to
> **three screens** and is intended to guide development for the next
> year. It sits downstream of `VISION.md`, `PRINCIPLES.md`, `ONTOLOGY.md`,
> and `COGNITIVE_ARCHITECTURE.md`, and it takes the adversarial review's
> verdict seriously: **narrow**. Where those documents describe a
> ten-year system, this describes the smallest thing that proves the core
> value. Not approved by the Product Owner. No screen described here is
> built.

## The one question this document answers

**How does a human move from reading something to changing how they
live?**

Everything below is subordinate to that sentence. The MVP is not a note
app, a graph, or a chatbot. It is a **belief ledger**: the place that
answers *"what do I currently believe, why, traced to its sources, and
how has my thinking changed?"* — the one thing Readwise (captures),
Obsidian (links), Tana (structures), and NotebookLM (answers) do not do.

The movement from reading to living is a single spine of three screens:

```
   CAPTURE            BELIEF INBOX             CONSTITUTION
 (get it in)  →   (decide what you think)  →  (see who you are becoming)
    raw              the act of judgment          the living result
```

Screen 1 is friction-free intake. Screen 2 is where formation actually
happens — the human deciding, in their own words, what they believe.
Screen 3 is the payoff that makes the whole loop worth repeating.

---

# Screen 1 — Capture

**Purpose:** Get a passage from the world into LifeOS with zero friction
and zero loss. Nothing on this screen may make the user hesitate.

## Layout

A single, quiet, centered column. One large text field dominates —
think focused-writing-app, not form. Minimal chrome: a small LifeOS
wordmark top-left, the user's avatar top-right, nothing else competing.
Below the text field, one optional, collapsed-by-default **Source** line
("Where's this from?"). One primary button. That is the entire screen.

The design intent: this should feel like a place you *drop* something,
not a place you *fill out*.

## Every button / control

- **The text field itself** — the primary surface. Autofocused on load.
  Paste-first: the expected gesture is Cmd/Ctrl+V.
- **Source line (optional, collapsed)** — expands to a single input for
  title/author/URL. If the user pastes a URL as the passage, the app
  offers to treat it as the source instead of the content. Never
  required. A capture with no source is valid (it's marked
  `authorAttribution: "anonymous"` or left blank — see `ONTOLOGY.md`).
- **Capture button (primary)** — the only prominent action. Label:
  **"Capture →"**. Enabled the moment the field is non-empty.
- **No save-as, no folders, no tags, no format toolbar.** Deliberately
  absent (see "What should be impossible").

## States

- **Empty state:** the field shows one line of ghost text — *"Paste
  something worth keeping."* — and nothing else. No onboarding wall, no
  sample gallery. For a true first-run user, a single dismissible line
  under the field: *"Paste a quote from anything you're reading. LifeOS
  will help you decide what you actually believe about it."*
- **Filled state:** ghost text gone, "Capture →" lit. A subtle character
  presence (not a count that induces anxiety) — just the button waking
  up.
- **Loading (submitting):** the passage does **not** disappear. The
  field locks, the button becomes a quiet spinner. The captured text
  stays on screen so the user never has the "did it eat my paste?"
  moment.
- **AI processing state:** after capture, the user is moved toward the
  Inbox, but the passage's claims may still be generating. The passage
  appears at the top of the Inbox immediately with a soft "Reading
  this…" shimmer where claims will land. **Capture is never blocked on
  AI.** The raw Quote is saved the instant Capture is pressed; AI
  proposal is a follow-on, not a gate.
- **Error state:** if the network or AI call fails, a calm inline
  message: *"Saved. We'll propose beliefs when we reconnect."* — because
  the Quote **was** saved locally/first. The user loses nothing and is
  not asked to retry a paste. A capture must never be lost to an error;
  this is the screen's cardinal rule.

## Keyboard shortcuts (desktop)

- **Cmd/Ctrl+V** — paste (native, but the field is always ready for it).
- **Cmd/Ctrl+Enter** — Capture. The power-user path: paste, Cmd+Enter,
  gone.
- **Esc** — clear the field (with a one-level undo).
- **Tab** — reveal the Source line.

## Mobile behavior

On mobile the real capture surface is the **OS share sheet**, not this
screen. "LifeOS" appears as a share target from any reading app, browser,
or Kindle highlight. Sharing a selection lands directly in a minimal
capture sheet with the same single "Capture" action. The in-app Capture
screen still exists (thumb-reachable button at the bottom, not the top),
but sharing-in is the primary mobile gesture. Formation starts where
reading already happens.

## Desktop behavior

The full-column focused view described above. Additionally, a global
system shortcut / browser extension that opens a capture popover over
whatever the user is reading — same single field, same Cmd+Enter. The
goal is that capturing never requires leaving what you're reading.

## What should feel effortless

Getting something in. Paste → Capture → done, in under five seconds,
with the confidence it can never be lost.

## What should be impossible

- Losing a captured passage to any error.
- Being forced to categorize, tag, title, or file anything at capture
  time.
- Editing the captured **Quote text** later (it is immutable —
  `ONTOLOGY.md`; corrections happen via Revision, never overwrite). The
  raw source is sacred; your *interpretation* is what's mutable, and that
  happens on Screen 2, not here.

---

# Screen 2 — Belief Inbox

**The heart of LifeOS.** This is where reading becomes belief. Every
design decision here serves one goal: make the act of judgment feel
light, fast, and *yours* — never like data-entry homework.

## What the AI proposes

For each captured Quote, the AI proposes a small number of candidate
**Claims** (1–3 per quote, never more), and — sparingly — a candidate
**Concept** to file a belief under, or an open **Question** the passage
raises. Claims are the spine; Concepts and Questions are secondary and
should never crowd the primary decision.

## The four actions

Every proposed claim offers exactly four responses:

- **Rewrite** (the hero action — see below)
- **Accept** (this is true, as stated)
- **Reject** (this is not something I believe / not worth keeping)
- **Question** (I'm not sure — hold this as an open question, not a
  belief)

Each maps directly to a `UserJudgment` (`ONTOLOGY.md`): `revised`,
`accepted`, `rejected`, `questioned`. The judgment is recorded
append-only, so the Inbox is not destroying proposals — it's deciding
their fate on the record.

## Why Rewrite is more valuable than Accept

**Accepting is passive; rewriting is formation.** When the AI proposes
"Saying 37 presents nakedness-without-shame as a precondition for
perception" and you *accept*, you've endorsed the AI's sentence. When you
**rewrite** it as "Shame is the thing that keeps me performing instead of
being seen" — you've done the actual cognitive work the entire product
exists to enable. You've moved the idea from the source's frame into
*your* frame, in *your* words, connected to *your* life.

This is the difference between a highlight and a belief. Readwise stores
the author's words. LifeOS stores *yours*. The rewrite is the moment
"information becomes understanding" (`COGNITIVE_ARCHITECTURE.md` §1) — and
it is the single most defensible thing this product does. Therefore the
UI must make Rewrite feel like the natural, encouraged, satisfying
default — not a power-user edge case behind Accept.

Concretely: the claim text is **directly editable inline**. The user
doesn't click "Rewrite" then get a modal — they just start typing on the
claim. The moment they change a character, "Accept" quietly relabels to
"Save my version." Rewriting is the path of least resistance, not an
extra step.

## Minimizing cognitive overload — the twenty-claims problem

**Never show twenty claims.** Cognitive load is the enemy of judgment,
and a wall of twenty cards guarantees either rubber-stamping or
abandonment.

- **One card at a time.** The Inbox is a single, centered card: the
  **Quote** on top (the evidence), one **proposed claim** below it, four
  actions beneath that. Everything needed for one honest decision, and
  nothing else.
- **A quiet progress indicator** — "3 of 12" — gives momentum without
  showing the pile. The pile is never rendered; only the next decision
  is.
- **Grouped by source.** All claims from one captured passage are
  reviewed together, so the user stays in one context ("I'm thinking
  about the Thomas passage") rather than context-switching every card.
- **After each decision:** the card animates away (a light, satisfying
  physical motion — a swipe/settle, not a jump), and the next card is
  already there. No page reload, no "next" click. Decision → motion →
  next. The rhythm is the reward.
- **Batching is opt-in, never default.** If ten low-stakes claims from
  one source are near-identical, the app may offer *"Accept all 4
  remaining from this passage?"* as a single explicit affordance — but
  the default is always one-at-a-time. This is the front line of the
  trust-tiering question (`COGNITIVE_ARCHITECTURE.md` §8): reduce
  friction on the low-stakes end, never lower the bar on the high-stakes
  end. A claim destined for the Constitution is never batch-approved.

## What happens after each decision

- **Accept / Save my version →** the claim becomes an accepted belief,
  eligible for the Constitution. A whisper-confirmation (no modal): the
  card settles away with a subtle checkmark.
- **Reject →** card away, no ceremony. The proposal is retained as
  record (you considered it and declined — that's data), but it leaves
  your view forever unless you go looking.
- **Question →** the claim converts to an open Question and lands in the
  "still working out" area of the Constitution rather than the belief
  set. It's not lost and not endorsed — it's *held*.
- **When the queue hits zero:** the reward screen. Not an empty grey
  void — a small, earned moment: *"Inbox clear. You made 12 decisions
  about what you believe today."* with a single button to **see them in
  your Constitution**. This is the hand-off from judgment to payoff.

## What makes this enjoyable rather than tedious

Momentum, agency, and closure. It should feel closer to clearing a
well-designed email inbox or a card game than to filling a spreadsheet:
one clear decision at a time, a satisfying motion after each, visible
progress, and a definite end with a payoff. The emotional target is *"I'm
sculpting what I think,"* not *"I'm processing a queue."* Keyboard-driven
on desktop (below) so it can enter a flow state.

## Keyboard shortcuts (desktop)

- **E** or just start typing — Rewrite (edit inline)
- **A** — Accept
- **R** — Reject
- **Q** — Question
- **Cmd/Ctrl+Enter** — Save my version (when editing)
- **Z** — undo last decision (judgments are append-only, so "undo" writes
  a corrective judgment — nothing is truly erased, but the UX is
  instant-forgiving)

A confident user can clear an inbox entirely from the keyboard, eyes on
the text, never touching the mouse. That is the target experience.

## Mobile behavior

One card, full-thumb-reach actions. **Swipe gestures** map to the
low-friction decisions (swipe right = Accept, swipe left = Reject), while
**Rewrite and Question are explicit taps** — because the two decisions
that carry the most judgment should require intention, not a flick. This
is deliberate: the gesture friction is inversely proportional to the
stakes.

---

# Screen 3 — Constitution

**This is not a notes page. Not a graph. Not an archive.** It is the
user's current worldview, rendered as something they are *proud to
open* — the answer to "who am I becoming?" made legible. If Screen 2 is
the work, Screen 3 is the reason the work is worth doing.

## How someone browses it

- **Organized by theme, not by time.** Beliefs are grouped under
  **Concepts** the user actually holds views about ("Shame," "Attention,"
  "Suffering," "Faith") — each a section header. Within a theme, beliefs
  are stated in **the user's own words** (the rewrites from Screen 2),
  one line each, readable as a coherent personal creed rather than a
  database dump.
- **The top of the page is a felt summary, not a table.** Something like:
  *"You hold 34 beliefs across 9 themes. 5 are newly formed this month. 2
  are in tension. 3 questions are still open."* — a living dashboard of a
  mind, not a record count.
- **Reading-first.** The default view is calm prose you could read
  top-to-bottom like a personal document. Structure (chains, sources,
  history) is available on demand, tucked behind each belief, never
  cluttering the surface. This is the inverse of a knowledge graph: the
  *human-legible synthesis* is primary; the machinery is one tap down.

## How a belief expands (derivation on demand)

Tap any belief and it opens to reveal its full chain — the thing nothing
else on the market shows:

```
BELIEF  "Shame keeps me performing instead of being seen."
  ↳ because of CLAIM  (the AI's original proposal, preserved)
      ↳ from QUOTE  "When you disrobe without being ashamed…"  [verbatim]
          ↳ in SOURCE  The Gospel of Thomas, Saying 37
  · your judgment history: proposed by AI → you rewrote it (Jul 9)
```

Provenance is the product. Every belief is one tap from the exact words
that seeded it and the record of how you handled it. This is what makes a
belief *trustworthy to your future self* — and it's `PRINCIPLES.md` §3
(every claim needs provenance) made visible.

## How beliefs evolve / how revisions appear

Beliefs are **versioned** (`ONTOLOGY.md`). When a user changes a belief,
the old version is never deleted — it's superseded via a `Revision`.
Inside an expanded belief, a quiet **"this belief has changed"** marker
reveals a small timeline: *"Jul 2024: 'Shame is always destructive' → Jan
2025: 'Shame can be protective as well as obstructive.'"* Seeing your own
mind change over time — honestly, without the old view erased — is one of
the most powerful things this page offers. It is the visible proof of
formation.

## How supporting sources appear

Under each belief, collapsed: the source(s) it derives from, by title.
Multiple sources supporting one belief is a strength signal, shown as
*"held from 3 sources"* — the belief has been triangulated, not taken on
one author's word.

## How contradictions appear

When two of the user's own beliefs (or a belief and a newly captured
claim) are in tension, the page surfaces it — never resolves it
(`PRINCIPLES.md` §4). A subtle **tension badge** on both beliefs, and a
dedicated **"In tension"** area near the top: *"You believe X, and also
Y. Worth sitting with?"* The app's job is to hold the contradiction up
honestly and invite the human to reconcile it (or decide to live with
it) — not to auto-pick a winner. Resolving a tension is a satisfying,
optional action, not a nag.

## How unanswered questions appear

A distinct section — **"Still working out"** — holding every `Question`
(from Screen 2's "Question" action, or surfaced tensions). This is
framed as a feature of a serious mind, not a to-do backlog: *the honest
edge of your understanding.* Questions can graduate into beliefs when the
user resolves them, closing the loop.

## What makes someone open this page every day

- **It changes as they do.** It's not static reference — it visibly grows
  and shifts with every inbox session.
- **"On this day" resurfacing.** A gentle daily resurfacing of a belief
  or quote from the past — *"A year ago you came to believe…"* — the
  formation loop's out-bound arm (the adversarial review's "retrieval is
  missing" fix). This is the single strongest daily-return hook.
- **One open question, offered.** The page can gently present one of the
  user's own open questions each day: *"You're still working out: does
  shame ever serve you? Anything to add today?"* — turning the
  Constitution into a prompt for reflection, not just a record of it.
- **Pride.** The deepest reason: it's a beautiful, legible portrait of
  one's own examined life. People return to things that make them feel
  like the person they want to be.

---

# The Ten Questions

**1. What is the first thing the user sees after signing in?**
Their **Constitution** — specifically, its felt-summary top and one
resurfaced belief from their past. Not an empty capture box, not a
tutorial. Returning users should immediately see *who they've become*,
which is both the payoff and the motivation. (A brand-new user with an
empty Constitution sees a warm one-line invitation to capture their first
passage.) The Constitution is home; Capture and Inbox are things you go
*do*.

**2. What makes someone come back tomorrow?**
The "on this day" resurfacing and the one offered open question — the
Constitution reaching out to them — plus the standing pull of an Inbox
with a decision or two waiting. The habit loop is: *the app shows me
something I once thought → I feel the continuity of my own mind → I
capture or judge one more thing.* Return is driven by identity, not
streaks or badges.

**3. What emotional experience should each screen create?**
- **Capture:** *relief / safety* — "it's held, I can let go of it now."
- **Belief Inbox:** *agency / momentum* — "I'm deciding what I think, and
  it feels good to move."
- **Constitution:** *pride / recognition* — "this is me, examined; I like
  who this is becoming."

**4. What should the user NEVER have to think about?**
Filing, folders, tags, formats, where something "goes," whether they'll
lose it, or database mechanics. Organization is the system's job; the
human's only job is judgment. The user thinks about *ideas*, never about
*bookkeeping*.

**5. What should the AI NEVER automatically do?**
Never accept a claim on the user's behalf. Never write, edit, or
"improve" a belief in the user's voice without the rewrite being the
user's own act. Never move anything to the Constitution without an
explicit human judgment. Never resolve a contradiction. Never touch
immutable Quote text. Never batch-approve high-stakes beliefs. AI
proposes; the human disposes — always (`AI_AGENT_RULES.md`,
`COGNITIVE_ARCHITECTURE.md` §8).

**6. Where will users become frustrated?**
- **Inbox volume** — a book yields hundreds of highlights; an
  undifferentiated queue is the #1 abandonment risk (proven in the
  Gospel of Thomas pilot). Mitigated by one-card focus, source-grouping,
  opt-in batching for the trivial, and a hard rule that LifeOS proposes
  *few, good* claims, not exhaustive ones.
- **Weak AI proposals** — a claim that misreads the passage is
  demoralizing. The rewrite action turns this from failure into
  feature (you fix it and it's *more* yours), but proposal quality is the
  make-or-break variable.
- **Capture friction on mobile** — solved only if share-sheet ingestion
  is genuinely one tap.

**7. How do we reduce friction without reducing human judgment?**
Separate the two axes. Reduce friction on **mechanics** (paste, keyboard
flow, swipes, no filing, instant motion, no reloads) as aggressively as
possible. Preserve friction on **judgment** exactly where stakes are high
(rewriting and questioning require intention; Constitution-bound beliefs
are never batch-approved; contradictions are never auto-resolved). The
design principle: *make the hands fast so the mind can be slow where it
matters.*

**8. What is the "aha!" moment of LifeOS?**
The first time a user **expands a belief in their Constitution and sees
the full chain** — their own sentence, tracing down through the AI's
claim, to the verbatim quote, to the source, with their judgment history
beside it — and realizes *"this is what I think, and I can prove to
myself exactly why."* No other tool gives them that. The secondary aha is
seeing a belief they've **changed over time**, old version intact.

**9. If Apple designed this product, what would they remove?**
Everything but the three screens — and then more. They'd remove Concepts
and Questions as *separate proposal types* on Screen 2 (claims only, MVP).
They'd remove the graph entirely (already done). They'd remove visible
status vocabulary ("proposed/accepted/contested") from the user's view —
those are internal, the user just sees beliefs, held-questions, and
tensions. They'd remove the Source line's complexity down to "paste and
we'll figure it out." They'd remove every number that isn't emotionally
meaningful. The product would be: paste, decide, behold. Three verbs.

**10. If the MVP were limited to only ONE AI call — what would it be?**
**Given a captured passage, propose 1–3 candidate belief-claims, each
tied to the exact quote span that supports it.** That single call is the
entire engine: it's what fills the Inbox, and the Inbox is what fills the
Constitution. Everything else (concepts, questions, tensions, synthesis)
can be deferred, faked, or done by the human. Without this one call there
is no product; with only this one call there still is one.

---

# Six-Week Launch — Ruthless Prioritization

If LifeOS ships in six weeks, here is what makes the cut. The bar: does
it serve *"reading → belief → living"* for one real user on one real
book? If not, it's gone.

### MUST HAVE (no product without these)
- **Capture (Screen 1):** paste text → immutable Quote + optional Source.
  Text paste only.
- **The one AI call:** passage → 1–3 claims tied to quote spans.
- **Belief Inbox (Screen 2):** one card at a time, four actions, **inline
  Rewrite**, keyboard-driven, source-grouped, clear-to-zero payoff.
- **Constitution (Screen 3):** beliefs in the user's words, grouped by
  theme, each expandable to its full provenance chain.
- **Immutability + judgment record:** Quotes never edited; every decision
  an append-only `UserJudgment`.
- **The boring foundation:** LIFEOS-001 deploy (auth, DB, hosting) — the
  unglamorous prerequisite that five architecture passes have deferred.

### SHOULD HAVE (real value, but launch survives without)
- **Belief revision over time** with visible version history (the second
  "aha" — powerful, but needs data to matter, so week-six-plus).
- **"On this day" resurfacing** (the strongest return hook — add the
  instant there's a corpus to resurface *from*).
- **Mobile share-sheet capture** (critical eventually; desktop-first is
  survivable for a founder-user for six weeks).
- **Concepts as real theme-grouping** (MVP can group by simple tags; true
  Concept objects later).

### NICE TO HAVE (delight, defer without guilt)
- Contradiction/tension surfacing.
- Open-question resurfacing as a daily reflection prompt.
- Opt-in batch-accept for trivial claims.
- Browser extension / global capture hotkey.
- Readwise/CSV import (the cheap path to volume — attractive, but not
  week-one).

### REMOVE (cut from MVP entirely — from `ONTOLOGY.md`'s 18 objects and
`COGNITIVE_ARCHITECTURE.md`'s machinery)
- **Argument** and premise-promotion — formal-logic layer, unproven need.
- **Megathread, Project, Practice-as-object, Person, Tradition** — none
  serve the core loop yet.
- **The event system, all background pipelines, named AI roles** —
  enterprise architecture for a single-user MVP; `Revision` +
  `UserJudgment` already give the audit trail.
- **Vector search, knowledge-graph UI, canonical identity resolution** —
  real problems at 100 books, fake problems at three.
- **`confidence` as a surfaced value** — already flagged uncalibrated
  (`ARCHITECTURE.md`); don't show it, don't sort by it.
- **Practice / Constitution "way of life" tracking as UI** — the vision's
  destination, but it cannot be designed honestly until beliefs exist and
  have been *lived against*. Ship the ledger first; earn the right to
  build the practice layer with real usage.

**The cut is the point.** These removed items are good ideas held for
later, not bad ideas — but a six-week MVP that tries to be the ten-year
system ships nothing. The three screens above prove the one thing that
matters: whether a human, given a frictionless path, will actually do the
work of turning what they read into what they believe. Only real usage
answers that — so the fastest honest route to real usage is the whole
strategy.
