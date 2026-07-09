# LifeOS Principles

> **PROVISIONAL.** These principles are a working foundation intended to
> prevent architectural drift and philosophical incoherence as LifeOS is
> built. They are not yet formally approved by the Product Owner and may
> be revised. Once approved, changes to this document should be treated
> as significant — these principles are meant to constrain future
> decisions, not bend to them.

These principles govern product, design, and engineering decisions across
LifeOS. When a feature, schema, or AI behavior is ambiguous, resolve the
ambiguity in favor of these principles over convenience or speed.

## 1. Knowledge serves formation, not accumulation

The point of capturing and organizing knowledge is not to have more of
it. A pile of notes nobody returns to is a failure state, even if it is
well-organized. Every feature should be evaluated against whether it
moves knowledge toward integration into how the user thinks and lives —
not just toward being stored.

## 2. AI assists judgment but does not replace judgment

AI in LifeOS organizes, connects, surfaces, and drafts — it does not
decide what is true, what matters, or what the user should believe or do.
The user remains the author of their own worldview and Constitution. AI
output is always input to the user's judgment, never a substitute for it.

## 3. Every claim needs provenance

A `Claim` without a traceable origin (a `Source`, a `Person`, the user's
own reasoning, or an AI inference clearly marked as such) is not
trustworthy and should not be treated as knowledge. Provenance must be
preserved at the data layer, not just as a UI convention — see
`ONTOLOGY.md` and `ARCHITECTURE.md`.

## 4. Disagreement should be preserved before synthesis

When sources conflict, or the user's own thinking is in tension, the
system should represent that tension explicitly before collapsing it into
a single answer. Premature synthesis destroys information. Synthesis
should be a visible, later step — not something that happens silently
during capture or organization.

## 5. User data must remain exportable

The user must always be able to get their knowledge, notes, quotes, and
Constitution out of LifeOS in a usable, non-proprietary form. No feature
should create lock-in as a side effect. This constrains schema design
(see `ARCHITECTURE.md` — Export/Backup Strategy) from the start, not as a
later migration.

## 6. Original sources must remain distinguishable from interpretation

A quote is not a summary. A summary is not a claim. A claim is not the
user's reflection on that claim. These layers must never be silently
merged — in storage, in the UI, or in AI output. See `ONTOLOGY.md` for how
this is encoded as distinct object types, and `AI_AGENT_RULES.md` for the
corresponding behavioral rule.

## 7. Long-term coherence matters more than short-term convenience

LifeOS is built to be used and trusted for years, not sessions. When a
shortcut would make today's feature easier but would compromise the
integrity, portability, or trustworthiness of the system over time, the
long-term property wins. This is the same spirit as the architecture
freeze: deliberate constraints now prevent costly incoherence later.
