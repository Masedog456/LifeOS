-- LIFEOS-024 — Cognitive orchestration & active intelligence.
--
-- Adds the `recommendations` table: the store behind the unified LifeOS Inbox.
-- Deterministic scanners (one per subsystem) each emit recommendation proposals;
-- the orchestrator merges them and persists here. A recommendation is an
-- OPPORTUNITY the user may accept / dismiss / snooze / complete — LifeOS never
-- acts on one automatically, and nothing here mutates knowledge. One additive,
-- own-rows table; migrations 0001–0018 are untouched; existing data preserved;
-- RLS enforced.

create table if not exists public.recommendations (
  id               uuid primary key,
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type             text not null,                       -- open_dialogue | create_synthesis | ...
  priority         text not null default 'low',         -- low | medium | high
  confidence       text not null default 'unknown',     -- unknown | low | moderate | high
  rationale        text not null default '',
  subsystem        text not null,                        -- originating scanner's subsystem
  suggested_action text not null default '',
  action_href      text,                                 -- where "act on this" navigates
  affected         jsonb not null default '[]'::jsonb,   -- RecommendationTarget[] (references, not copies)
  signature        text not null default '',             -- stable dedupe key (type + sorted affected ids)
  created_at       timestamptz not null default now(),
  dismissed        boolean not null default false,
  accepted         boolean not null default false,
  completed        boolean not null default false,
  snoozed_until    timestamptz
);

create index if not exists recommendations_user_created_idx   on public.recommendations (user_id, created_at desc);
create index if not exists recommendations_user_subsystem_idx on public.recommendations (user_id, subsystem);
create index if not exists recommendations_user_type_idx      on public.recommendations (user_id, type);
create index if not exists recommendations_user_signature_idx on public.recommendations (user_id, signature);

alter table public.recommendations enable row level security;

do $$
begin
  drop policy if exists recommendations_select on public.recommendations;
  drop policy if exists recommendations_insert on public.recommendations;
  drop policy if exists recommendations_update on public.recommendations;
  drop policy if exists recommendations_delete on public.recommendations;
  create policy recommendations_select on public.recommendations
    for select using (auth.uid() = user_id);
  create policy recommendations_insert on public.recommendations
    for insert with check (auth.uid() = user_id);
  create policy recommendations_update on public.recommendations
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy recommendations_delete on public.recommendations
    for delete using (auth.uid() = user_id);
end $$;
