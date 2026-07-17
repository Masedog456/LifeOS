-- LIFEOS-022 — Socratic dialogue & dialectical engine.
--
-- A dialogue session is a structured investigation of an idea through turn-based
-- inquiry grounded in the USER's own knowledge. Not a chatbot, not roleplay, not
-- autonomous reasoning: the Socratic engine proposes deterministic prompts, the
-- perspectives cite the user's own records, and the knowledge graph surfaces
-- related evidence. One jsonb-bearing row per session holding participants
-- (perspectives sourced from the user's constitution/frameworks/principles/
-- beliefs/research/authoring), turns (each with kind + provenance citations +
-- timeline flags), spawned outcomes (references to records the dialogue created),
-- an append-only change log, and a freshness fingerprint. Additive and
-- rerunnable; migrations 0001–0016 are untouched; existing data preserved; RLS
-- enforced.

create table if not exists public.dialogue_sessions (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title         text not null default '',
  topic         text not null default '',
  purpose       text not null default '',
  status        text not null default 'open',   -- open|active|paused|concluded|archived
  participants  jsonb not null default '[]'::jsonb,  -- perspectives (viewpoints from the user's own knowledge)
  seed_refs     jsonb not null default '[]'::jsonb,  -- records the dialogue is about (references, not copies)
  turns         jsonb not null default '[]'::jsonb,  -- append-only turns, each with citations + flags
  outcomes      jsonb not null default '[]'::jsonb,  -- records this dialogue spawned (provenance)
  history       jsonb not null default '[]'::jsonb,  -- append-only change log
  fingerprint   jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists dialogue_sessions_user_created_idx on public.dialogue_sessions (user_id, created_at desc);
create index if not exists dialogue_sessions_user_updated_idx on public.dialogue_sessions (user_id, updated_at desc);

alter table public.dialogue_sessions enable row level security;

-- Own-rows CRUD. Update is permitted so append-only turns/outcomes/history (kept
-- inside jsonb arrays by the app) can be added to an existing row; RLS still
-- confines every operation to the owner.
do $$
begin
  drop policy if exists dialogue_sessions_select on public.dialogue_sessions;
  drop policy if exists dialogue_sessions_insert on public.dialogue_sessions;
  drop policy if exists dialogue_sessions_update on public.dialogue_sessions;
  drop policy if exists dialogue_sessions_delete on public.dialogue_sessions;
  create policy dialogue_sessions_select on public.dialogue_sessions
    for select using (auth.uid() = user_id);
  create policy dialogue_sessions_insert on public.dialogue_sessions
    for insert with check (auth.uid() = user_id);
  create policy dialogue_sessions_update on public.dialogue_sessions
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy dialogue_sessions_delete on public.dialogue_sessions
    for delete using (auth.uid() = user_id);
end $$;
