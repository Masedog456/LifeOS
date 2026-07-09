# LifeOS

LifeOS is a personal intelligence OS — a single-user application for capturing,
organizing, and eventually reasoning over personal data, built on Next.js,
Supabase, and the Anthropic API.

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

## Project memory

See [PROJECT_MEMORY.md](./PROJECT_MEMORY.md) for current project state, what's
next, and the decisions log.
