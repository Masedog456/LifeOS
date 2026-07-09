# AI Agent Rules

> **PROVISIONAL.** These are the rules any AI agent (Claude Code or
> otherwise) must follow when working on the LifeOS codebase or content.
> They apply on top of, not instead of, any specific ticket's
> instructions. If a ticket's instructions and these rules ever conflict,
> stop and ask the Product Owner rather than silently picking one.

## The rules

1. **Never overwrite source text.** `Quote.text` and any other field
   marked immutable in `ONTOLOGY.md` must never be edited in place. If a
   correction is genuinely needed (e.g. a transcription error), create a
   `Revision` that records both the old and new value — never a silent
   overwrite.

2. **Never invent citations.** Do not fabricate sources, quotes, page
   numbers, authors, or bibliographic details. If a citation is uncertain
   or unavailable, say so explicitly rather than filling the gap with a
   plausible-sounding guess.

3. **Separate source, summary, interpretation, and personal reflection.**
   These are different `ONTOLOGY.md` object types (`Quote`, a
   summary/`Note`, `Claim`/`Argument`, `Reflection`) for a reason. Never
   merge them into a single undifferentiated blob of text, in storage, in
   the UI, or in AI-generated output.

4. **Preserve contradictions.** When sources or the user's own reasoning
   disagree, represent that disagreement explicitly (per
   `PRINCIPLES.md` §4) rather than silently resolving it into a single
   answer. Synthesis is a distinct, later, visible step.

5. **Ask before destructive changes.** Deleting data, rewriting history,
   force-pushing, or any other hard-to-reverse action requires explicit
   confirmation from the Product Owner first — consistent with the
   broader operating instructions governing this repo.

6. **Never commit secrets.** No API key, credential, or `.env.local`
   value is ever written to a tracked file, a commit, or a log. Secrets
   are provided by the human at runtime and referenced only via
   environment variables — never invented, never hardcoded.

7. **Prefer small, testable changes.** Favor incremental, verifiable
   steps over large speculative changes. Run lint/build (and any relevant
   tests) after changes, and report actual results — never claim
   something works without having checked.

8. **Update `PROJECT_MEMORY.md` after meaningful changes.** Current
   Sprint Status, Open Questions/Blockers, and the Change Log should
   reflect reality at the end of any work session that changed it.

9. **Mark assumptions clearly.** When a required input, document, or
   decision is missing, do not guess and present the guess as fact. Use
   clearly labeled placeholders/provisional language (as this document
   and its siblings do) and surface the gap to the Product Owner.

## Why these exist

LifeOS's core value depends on the user being able to trust what the
system tells them came from where, and being able to see their own
thinking evolve honestly over time. An AI agent that silently merges
summary and source, invents a citation, or quietly resolves a
contradiction doesn't just introduce a bug — it corrupts the thing LifeOS
exists to protect (`PRINCIPLES.md` §§3, 4, 6). These rules are the
behavioral enforcement of those principles, the same way `ONTOLOGY.md`'s
mutability rules are the data-layer enforcement of them.
