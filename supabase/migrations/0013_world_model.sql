-- LIFEOS-018 — Worldview & concept graph.
--
-- The conceptual backbone of LifeOS: concepts, richly-annotated relationships
-- between them, reusable principles, and worldview frameworks that ORGANIZE
-- concepts (never own beliefs). Deterministic-first and human-reviewed:
-- relationships are proposed and only shape the graph once a human approves
-- them; nothing here changes a belief or the Constitution. Concept↔concept
-- structure is denormalized onto the concept row but maintained solely through
-- approved relationships. Four jsonb-bearing tables, own-rows RLS, additive and
-- rerunnable; migrations 0001–0012 are untouched; existing data preserved.

create table if not exists public.concepts (
  id                 uuid primary key,
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name               text not null default '',
  aliases            jsonb not null default '[]'::jsonb,
  definition         text not null default '',
  description        text not null default '',
  related_beliefs    jsonb not null default '[]'::jsonb,
  related_threads    jsonb not null default '[]'::jsonb,
  related_sources    jsonb not null default '[]'::jsonb,
  related_practices  jsonb not null default '[]'::jsonb,
  parent_concepts    jsonb not null default '[]'::jsonb,  -- maintained via approved relationships
  child_concepts     jsonb not null default '[]'::jsonb,
  related_concepts   jsonb not null default '[]'::jsonb,
  opposing_concepts  jsonb not null default '[]'::jsonb,
  principle_ids      jsonb not null default '[]'::jsonb,
  questions          jsonb not null default '[]'::jsonb,
  history            jsonb not null default '[]'::jsonb,   -- append-only evolution
  status             text not null default 'active',       -- proposed|active|archived|merged
  fingerprint        jsonb,
  source             text not null default 'user',          -- user|ai|mock|deterministic
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.concept_relationships (
  id                 uuid primary key,
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  from_concept_id    uuid not null,
  to_concept_id      uuid not null,
  type               text not null,                        -- supports|depends_on|contradicts|extends|refines|contains|requires|explains|analogous_to|historically_related|terminologically_related|part_of
  reason             text not null default '',
  citations          jsonb not null default '[]'::jsonb,
  confidence         text not null default 'medium',        -- low|medium|high
  source             text not null default 'user',
  approved           boolean not null default false,        -- only approved edges shape the graph
  history            jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.principles (
  id                 uuid primary key,
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  statement          text not null default '',
  description        text,
  concept_ids        jsonb not null default '[]'::jsonb,
  belief_ids         jsonb not null default '[]'::jsonb,   -- beliefs that derive from it (references, not owned)
  citations          jsonb not null default '[]'::jsonb,
  status             text not null default 'active',        -- proposed|active|archived
  history            jsonb not null default '[]'::jsonb,
  source             text not null default 'user',
  fingerprint        jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.frameworks (
  id                 uuid primary key,
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name               text not null default '',
  kind               text not null default 'framework',     -- framework|tradition|school|paradigm|map
  description        text not null default '',
  concept_ids        jsonb not null default '[]'::jsonb,    -- frameworks ORGANIZE concepts; never own beliefs
  principle_ids      jsonb not null default '[]'::jsonb,
  status             text not null default 'active',        -- active|archived
  history            jsonb not null default '[]'::jsonb,    -- append-only membership history
  source             text not null default 'user',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists concepts_user_created_idx on public.concepts (user_id, created_at desc);
create index if not exists concept_relationships_user_idx on public.concept_relationships (user_id, from_concept_id);
create index if not exists principles_user_created_idx on public.principles (user_id, created_at desc);
create index if not exists frameworks_user_created_idx on public.frameworks (user_id, created_at desc);

alter table public.concepts enable row level security;
alter table public.concept_relationships enable row level security;
alter table public.principles enable row level security;
alter table public.frameworks enable row level security;

-- Own-rows CRUD on every table. Update is permitted so append-only history
-- (kept inside jsonb arrays by the app) and human approvals can be written to
-- an existing row; RLS still confines every operation to the owner.
do $$
declare t text;
begin
  foreach t in array array['concepts', 'concept_relationships', 'principles', 'frameworks']
  loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select using (auth.uid() = user_id)', t);
    execute format('create policy %1$s_insert on public.%1$s for insert with check (auth.uid() = user_id)', t);
    execute format('create policy %1$s_update on public.%1$s for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy %1$s_delete on public.%1$s for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;
