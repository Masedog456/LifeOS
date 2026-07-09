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
- [ARCHITECTURE.md](./ARCHITECTURE.md) — proposed technical architecture
  (design/spec only — nothing here is implemented yet)
- [AI_AGENT_RULES.md](./AI_AGENT_RULES.md) — rules AI agents must follow
  when working on this codebase

All of the above are provisional drafts pending final Product Owner
sign-off (see the notice at the top of each file).
