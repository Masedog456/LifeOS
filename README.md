# LifeOS

LifeOS is an AI-native operating system for lifelong intellectual, personal,
and spiritual formation — a single-user application that turns books,
notes, conversations, and reflections into organized knowledge and
practical life formation, built on Next.js, Supabase, and the Anthropic
API.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values (see comments in .env.example)
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

Other useful commands:

```bash
npm run build   # production build
npm run lint    # lint check
```

## Project memory & foundation docs

- [PROJECT_MEMORY.md](./PROJECT_MEMORY.md) — current project state, what's
  next, and the change log
- [VISION.md](./VISION.md) — product direction
- [PRINCIPLES.md](./PRINCIPLES.md) — product principles that constrain
  design and engineering decisions
- [ONTOLOGY.md](./ONTOLOGY.md) — the first-class objects LifeOS is built
  around
- [COGNITIVE_ARCHITECTURE.md](./COGNITIVE_ARCHITECTURE.md) — how knowledge
  moves through the system: the lifecycle, AI roles, events, and human
  oversight boundaries (design only — nothing here is implemented yet)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — proposed technical architecture
  (design/spec only — nothing here is implemented yet)
- [INGESTION.md](./INGESTION.md) — the ingestion architecture: adapters,
  the extraction seam, and the replaceable processing pipeline (LIFEOS-006)
- [AI_AGENT_RULES.md](./AI_AGENT_RULES.md) — rules AI agents must follow
  when working on this codebase
- [PILOT_GOSPEL_OF_THOMAS_SAYING_37.md](./PILOT_GOSPEL_OF_THOMAS_SAYING_37.md)
  — a manual pilot walkthrough stress-testing the ontology and cognitive
  architecture against a real use case, with findings and recommendations
- [UX_SPECIFICATION.md](./UX_SPECIFICATION.md) — the MVP interaction
  blueprint: three screens (Capture, Belief Inbox, Constitution) and a
  ruthless six-week feature prioritization (design only — nothing built)
- [QA_CHECKLIST.md](./QA_CHECKLIST.md) — manual QA steps for the
  implemented Belief Thread MVP local trial
- [PERSISTENCE_QA.md](./PERSISTENCE_QA.md) — Supabase/Vercel setup steps
  (incl. email magic-link auth) and QA for durable persistence + real AI
  (LIFEOS-004 / 004.1)
- [TRIAL_GUIDE.md](./TRIAL_GUIDE.md) — how to use the local prototype for
  the two-week personal trial, and how to judge whether it's valuable

All of the above are provisional drafts pending final Product Owner
sign-off (see the notice at the top of each file).
