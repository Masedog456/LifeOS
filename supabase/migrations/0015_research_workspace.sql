-- LIFEOS-020 — Research workspace.
--
-- A research project is a structured investigation the USER runs BEFORE writing
-- conclusions: a primary question plus subquestions/unknowns/assumptions/
-- definitions/success-criteria/open-problems (each with its own history), an
-- evidence workspace (references to existing records via `assembly` — never
-- copies), project-local notes, competing hypotheses (user-stated confidence,
-- supporting/contradicting evidence, open questions, status, history), an
-- explicit user-authored argument map (nodes + edges), an append-only project
-- change log, and a freshness fingerprint. Not autonomous, not web-browsing,
-- not an agent: evidence-first, deterministic-first, human-directed. A project
-- can seed the Authoring Engine (`seeded_project_id`) with no content
-- duplication. One jsonb-bearing row per project. Additive and rerunnable;
-- migrations 0001–0014 are untouched; existing data preserved; RLS enforced.

create table if not exists public.research_projects (
  id                 uuid primary key,
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title              text not null default '',
  question           text not null default '',
  description        text not null default '',
  purpose            text not null default '',
  scope              text not null default '',
  status             text not null default 'open',  -- open|investigating|synthesizing|concluded|archived|abandoned
  questions          jsonb not null default '{}'::jsonb,   -- subquestions/unknowns/assumptions/definitions/success-criteria/open-problems (each with history)
  assembly           jsonb not null default '{}'::jsonb,   -- evidence workspace: references across every record type (not copies)
  notes              jsonb not null default '[]'::jsonb,   -- project-local notes
  hypotheses         jsonb not null default '[]'::jsonb,   -- competing hypotheses (never auto-selected)
  argument_nodes     jsonb not null default '[]'::jsonb,   -- claims/evidence/counterarguments/objections/rebuttals/open-questions/unknowns
  argument_edges     jsonb not null default '[]'::jsonb,   -- explicit, user-authored relationships
  history            jsonb not null default '[]'::jsonb,   -- append-only project change log
  fingerprint        jsonb,
  seeded_project_id  text,                                  -- the KnowledgeProject this seeded, if any
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists research_projects_user_created_idx
  on public.research_projects (user_id, created_at desc);

alter table public.research_projects enable row level security;

-- Own-rows CRUD. Update is permitted so append-only history (kept inside jsonb
-- arrays by the app) can be added to an existing row; RLS still confines every
-- operation to the owner.
do $$
begin
  drop policy if exists research_projects_select on public.research_projects;
  drop policy if exists research_projects_insert on public.research_projects;
  drop policy if exists research_projects_update on public.research_projects;
  drop policy if exists research_projects_delete on public.research_projects;
  create policy research_projects_select on public.research_projects
    for select using (auth.uid() = user_id);
  create policy research_projects_insert on public.research_projects
    for insert with check (auth.uid() = user_id);
  create policy research_projects_update on public.research_projects
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy research_projects_delete on public.research_projects
    for delete using (auth.uid() = user_id);
end $$;
