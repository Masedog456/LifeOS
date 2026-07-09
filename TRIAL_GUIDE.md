# LifeOS — Two-Week Trial Guide

> This is a personal-use guide for the LIFEOS-002 Belief Thread MVP. It is
> not a spec. The goal of the next two weeks is to answer one question:
> **will you actually do the work of turning what you read into what you
> believe — and does watching your beliefs accumulate and bend over time
> feel valuable?** Everything below serves that question.
>
> Practical notes: data lives in this browser's `localStorage` only, so do
> the whole trial in **one browser on one machine**, and don't clear the
> profile. Run it with `npm run dev` → http://localhost:3000. There's no
> account and no sync — that's fine for a trial. If you need to start over,
> the Constitution page has a "Reset local prototype data" footer.

---

## The daily routine (aim for ~10 minutes)

Do this once a day, ideally at the same time (after your morning reading,
or at night as a wind-down):

1. **Open the app.** You land on the Constitution — your current beliefs.
   Read the one resurfaced thought at the top of the Capture screen if it
   shows one. Ask yourself honestly: *does this still feel true?*
2. **Capture 1–3 things** from what you read or thought about today. Not
   twenty. One to three. Quality over volume.
3. **Clear your Inbox.** Judge each proposal — one at a time. This is the
   core act; don't skip it or let proposals pile up.
4. **Visit the Constitution.** Spend one minute looking at what's
   accumulating. Once or twice a week, expand an older belief and decide:
   still true, needs revising, or now a question?

That's the loop. **Capture → judge → occasionally revisit.** If you only
have two minutes, do step 3 (clear the inbox) — an unjudged proposal is
worth nothing; a judged belief is the whole point.

Don't try to be comprehensive. Missing a day is fine. The trial is about
whether the *rhythm* earns a place in your life, not about perfect
coverage.

---

## What source material to start with

Pick **one book you're already actively reading** — ideally something you
think *with*, not just consume: philosophy, theology, a serious essay
collection, a spiritual text. The Gospel of Thomas pilot used exactly this
kind of material and it fit well.

Good starting sources:
- A book you're currently reading and marking up.
- Highlights you've made in the last week (paste them in one at a time).
- A conversation or sermon that stuck with you.
- Your own recurring thoughts — you don't need an external source at all.

Avoid, for the trial:
- Trying to import a whole backlog at once (you'll drown the Inbox — the
  known failure mode).
- Reference/how-to material (facts don't become *beliefs*; this tool is
  for convictions, not information).

Start narrow. One book, one theme, is a better test than ten books
skimmed.

---

## What counts as a good capture

A good capture is **a passage or thought you'd want to have an opinion
about** — something that could plausibly become a belief you hold.

Good captures:
- A sentence that provoked a reaction ("yes" or "no" or "wait…").
- A claim an author makes that you want to test against your own view.
- A tension you noticed between two things you've read.
- A thought of your own you don't want to lose.

Weak captures (they'll produce hollow proposals):
- Purely factual snippets with nothing to believe or dispute.
- Whole pages pasted at once — capture the one line that mattered, not the
  chapter.
- Vague vibes with no proposition in them.

Rule of thumb: if you can't imagine yourself later saying *"I believe…"*
or *"I don't believe…"* about it, it's probably not a capture.

---

## When to Rewrite vs Accept vs Question vs Reject

This is the heart of the trial. **Rewrite is the primary action — reach
for it first.**

- **Rewrite** — the AI's claim is roughly right but not in *your* words,
  or not quite *your* thought. Rewrite it until it's the sentence *you*
  would say. This is where reading becomes belief; if you find yourself
  rewriting often and it feels satisfying, that's the strongest possible
  signal the tool works. Default here.
- **Accept** — the proposed claim is already exactly what you believe,
  word for word. Use it, but notice: if you're accepting a lot without
  editing, either the AI is unusually good or you're rubber-stamping.
  Watch for the second.
- **Question** — you're genuinely unsure, or it's a real tension you want
  to sit with rather than resolve. This is not a failure state — a mind
  with open questions is working. These land in "Still working out."
- **Reject** — it's not something you believe, misreads the source, or
  isn't worth keeping. Reject freely and without guilt; a clean Inbox
  matters more than a complete one.

If you're ever unsure between Question and Reject: **Question** keeps it in
view, **Reject** archives it. When in doubt and it's interesting, Question.

---

## What to look for in the Constitution page

This is the payoff screen. Over two weeks, watch for:

- **Does it read like *you*?** Skim your beliefs top to bottom. Does it
  feel like an honest portrait of what you actually think, or like a pile
  of the AI's sentences? (If the former — that's the product working.)
- **Themes forming.** Are beliefs clustering under themes you care about?
  Does seeing them grouped tell you something about your own
  preoccupations?
- **Threads bending.** When you revise or question a belief, expand it and
  look at the thread line. *Can you see your thinking change over time?*
  This is the single most distinctive thing the tool offers — pay
  attention to whether it lands emotionally.
- **Provenance.** Expand a belief and trace it down to the original
  capture. Does being able to answer *"why do I believe this?"* feel
  valuable, or like clutter?
- **Open questions.** Does the "still open" set feel like a useful map of
  your unfinished thinking, or like nagging?

Once or twice in the two weeks, deliberately **revisit an old belief and
change your mind** on purpose — then look at the thread. Whether that
moment feels meaningful is close to the whole test.

---

## What friction to track

Keep a running note (on paper, or capture it *into* LifeOS itself) of
anything that made you hesitate or stop. Specifically watch:

- **Inbox fatigue** — did clearing the Inbox ever feel like a chore? At
  what volume? This is the #1 predicted failure mode; log it precisely
  (e.g. "started skimming at ~8 proposals").
- **Bad proposals** — how often did the AI (mock, for now) misread you?
  Did rewriting fix it, or did a bad proposal sour the session?
- **Capture friction** — did you *not* capture something because opening
  the app / pasting was too much bother? Where did you lose thoughts?
- **Empty returns** — did you ever open the app and find nothing worth
  doing? When?
- **Anything you wished it did** — note it, but don't expect it this
  trial. The point is to learn what's missing, not to build it now.

Friction you track is the most valuable output of this trial — more than
the beliefs themselves.

---

## What would prove the MVP is valuable

Signs to take seriously (any two or three of these is a strong result):

- **You come back without being reminded.** The habit forms on its own.
- **You reach for Rewrite often, and it feels good** — turning the AI's
  draft into your own sentence is satisfying, not tedious.
- **You reopen the Constitution just to read it**, not only to add to it.
- **A thread genuinely moved you** — seeing a belief you changed your mind
  about, with the old version intact, felt like something.
- **You caught yourself thinking about a capture during the day** — the
  system extended your thinking beyond the screen.
- **You'd be annoyed to lose the data.** At the end of two weeks, the idea
  of `Reset` feels like a real loss.

---

## What would prove it is NOT valuable

Be honest — these are the results that should stop the project, or force a
pivot, not be explained away:

- **You forget it exists.** No pull to return; the habit never forms.
- **Clearing the Inbox feels like homework** every time, and you start
  avoiding it or rubber-stamping.
- **The beliefs don't feel like yours** — reading the Constitution feels
  like reading someone else's summary, and Rewrite didn't fix that.
- **You never revisit anything.** The "watch your thinking bend" promise
  never happens because you don't come back to old beliefs.
- **Capture never fit your reading** — the friction of getting things in
  meant you mostly didn't.
- **At two weeks, wiping the data costs you nothing.** No loss felt.

If the trial lands here, that's not a failure of the trial — it's the
trial doing its job. The honest verdict is worth far more than two more
weeks of hoping.

---

## After two weeks

Don't decide day-to-day. At the end, sit down once and answer: *did this
earn a place in how I read and think?* Write the verdict — build on it,
narrow it, or stop — into `PROJECT_MEMORY.md`'s Change Log, with the
friction notes that led you there. Only then decide whether to invest in
persistence (real database + AI, LIFEOS-001 T3+) or to walk away.
