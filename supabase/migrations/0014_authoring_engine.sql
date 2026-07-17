-- LIFEOS-019 — Knowledge synthesis & authoring engine.
--
-- A knowledge project is a book/essay/lecture/course/paper/blog/guide/philosophy
-- the USER authors from everything they have learned. It references (never
-- copies) evidence across every record type via `assembly`, keeps generated
-- outline candidates, the chosen outline, drafted sections (each with
-- paragraph-level citations and append-only version history), an append-only
-- project change log, and a freshness fingerprint. Evidence-first and
-- human-directed: the system assembles, proposes outlines, and drafts one
-- section at a time on request — it never writes autonomously and never invents
-- citations. One jsonb-bearing row per project. Additive and rerunnable;
-- migrations 0001–0013 are untouched; existing data preserved; RLS enforced.

create table if not exists public.knowledge_projects (
  id                 uuid primary key,
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title              text not null default '',
  description        text not null default '',
  purpose            text not null default '',
  audience           text not null default '',
  kind               text not null default 'essay',  -- book|essay|lecture|course|research_paper|blog_series|guide|philosophy
  status             text not null default 'planning', -- planning|outlining|drafting|revising|complete|archived
  assembly           jsonb not null default '{}'::jsonb,   -- chosen evidence ids across every record type (references, not copies)
  outline_options    jsonb not null default '[]'::jsonb,   -- generated outline candidates
  chosen_outline_id  text,
  sections           jsonb not null default '[]'::jsonb,   -- drafted sections: paragraphs (with citations) + append-only versions
  history            jsonb not null default '[]'::jsonb,   -- append-only project change log
  fingerprint        jsonb,
  ai_model           text not null default 'mock',
  source             text not null default 'mock',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists knowledge_projects_user_created_idx
  on public.knowledge_projects (user_id, created_at desc);

alter table public.knowledge_projects enable row level security;

-- Own-rows CRUD. Update is permitted so append-only section-version history and
-- the project change log (kept inside jsonb arrays by the app) can be added to
-- an existing row; RLS still confines every operation to the owner.
do $$
begin
  drop policy if exists knowledge_projects_select on public.knowledge_projects;
  drop policy if exists knowledge_projects_insert on public.knowledge_projects;
  drop policy if exists knowledge_projects_update on public.knowledge_projects;
  drop policy if exists knowledge_projects_delete on public.knowledge_projects;
  create policy knowledge_projects_select on public.knowledge_projects
    for select using (auth.uid() = user_id);
  create policy knowledge_projects_insert on public.knowledge_projects
    for insert with check (auth.uid() = user_id);
  create policy knowledge_projects_update on public.knowledge_projects
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy knowledge_projects_delete on public.knowledge_projects
    for delete using (auth.uid() = user_id);
end $$;
