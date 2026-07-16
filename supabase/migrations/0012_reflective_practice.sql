-- LIFEOS-017 — Reflective practice & daily formation.
--
-- A formation session is a structured reflection the USER writes and integrates:
-- a typed prompt, an immutable reflection body, explicit links to the rest of
-- the system (decisions/beliefs/practices/threads/inquiries/sources/reflections),
-- user-authored structured capture (lessons, unresolved questions, emotional
-- observations, revised assumptions, belief candidates, follow-up reflections),
-- an evidence packet (references to existing records — never copied source
-- text), a validated, cited synthesis with append-only history, append-only
-- judgments, and a freshness fingerprint. LifeOS asks and clarifies — it never
-- concludes for the user, and nothing here changes the Constitution, a decision,
-- or a thread automatically. One jsonb-bearing row per session (mirroring
-- decisions/reasonings). Additive and rerunnable; migrations 0001–0011 are
-- untouched; existing data preserved; RLS enforced.

create table if not exists public.formation_sessions (
  id                     uuid primary key,
  user_id                uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title                  text not null default '',
  type                   text not null default 'open',  -- morning|evening|decision_review|book_integration|conversation_review|failure_analysis|success_analysis|conflict_reflection|practice_reflection|open|custom
  custom_type            text,
  prompt                 text not null default '',
  suggested_prompts      jsonb not null default '[]'::jsonb,
  reflection             text not null default '',       -- immutable once written
  linked_decisions       jsonb not null default '[]'::jsonb,
  linked_beliefs         jsonb not null default '[]'::jsonb,
  linked_practices       jsonb not null default '[]'::jsonb,
  linked_threads         jsonb not null default '[]'::jsonb,
  linked_inquiries       jsonb not null default '[]'::jsonb,
  linked_sources         jsonb not null default '[]'::jsonb,
  linked_reflections     jsonb not null default '[]'::jsonb,
  seed_refs              jsonb not null default '[]'::jsonb,
  lessons                jsonb not null default '[]'::jsonb,
  unresolved_questions   jsonb not null default '[]'::jsonb,
  emotional_observations jsonb not null default '[]'::jsonb,
  revised_assumptions    jsonb not null default '[]'::jsonb,
  belief_candidates      jsonb not null default '[]'::jsonb,
  follow_up_reflections  jsonb not null default '[]'::jsonb,
  evidence               jsonb not null default '[]'::jsonb,  -- references, not text copies
  synthesis              jsonb,
  synthesis_source       text,                                 -- ai|mock
  history                jsonb not null default '[]'::jsonb,   -- append-only prior syntheses
  fingerprint            jsonb,
  judgments              jsonb not null default '[]'::jsonb,   -- append-only human verdicts
  status                 text not null default 'draft',        -- draft|reflecting|synthesized|closed
  sensitive              text,                                 -- caution text for sensitive topics
  ai_model               text not null default 'mock',
  source                 text not null default 'mock',
  coverage               text,
  partial                boolean not null default false,
  verified               boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists formation_sessions_user_created_idx
  on public.formation_sessions (user_id, created_at desc);

alter table public.formation_sessions enable row level security;

-- Own-rows CRUD. Update is permitted so append-only history/judgments (kept
-- inside jsonb arrays by the app) and the user's structured capture can be
-- added to an existing row; RLS still confines every operation to the owner.
do $$
begin
  drop policy if exists formation_sessions_select on public.formation_sessions;
  drop policy if exists formation_sessions_insert on public.formation_sessions;
  drop policy if exists formation_sessions_update on public.formation_sessions;
  drop policy if exists formation_sessions_delete on public.formation_sessions;
  create policy formation_sessions_select on public.formation_sessions
    for select using (auth.uid() = user_id);
  create policy formation_sessions_insert on public.formation_sessions
    for insert with check (auth.uid() = user_id);
  create policy formation_sessions_update on public.formation_sessions
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy formation_sessions_delete on public.formation_sessions
    for delete using (auth.uid() = user_id);
end $$;
