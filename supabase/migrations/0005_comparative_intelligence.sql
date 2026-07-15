-- LIFEOS-010 — Comparative intelligence.
--
-- A comparison is a saved PROPOSAL: a structured, evidence-cited synthesis
-- over 2–5 materials (or a belief + sources). The whole record is stored as
-- one row with jsonb columns (mirroring how `sources` stores derived jsonb),
-- including its append-only human judgments. Additive and rerunnable;
-- migrations 0001–0004 are untouched; existing data preserved; RLS enforced.

create table if not exists public.comparisons (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null default '',
  question    text not null default '',
  inputs      jsonb not null default '[]'::jsonb,
  source_ids  jsonb not null default '[]'::jsonb,
  belief_ids  jsonb not null default '[]'::jsonb,
  evidence    jsonb not null default '[]'::jsonb,
  result      jsonb not null default '{}'::jsonb,
  ai_model    text not null default 'mock',
  source      text not null default 'mock',      -- 'ai' | 'mock'
  coverage    text,                              -- 'sampled' | 'full' | null
  partial     boolean not null default false,
  verified    boolean not null default false,
  judgments   jsonb not null default '[]'::jsonb, -- append-only human verdicts
  created_at  timestamptz not null default now()
);

create index if not exists comparisons_user_created_idx on public.comparisons (user_id, created_at desc);

alter table public.comparisons enable row level security;

-- Own-rows CRUD. Update is permitted so append-only judgments (kept inside
-- the jsonb `judgments` array by the app) can be added to an existing row;
-- RLS still confines every operation to the owner.
do $$
begin
  drop policy if exists comparisons_select on public.comparisons;
  drop policy if exists comparisons_insert on public.comparisons;
  drop policy if exists comparisons_update on public.comparisons;
  drop policy if exists comparisons_delete on public.comparisons;
  create policy comparisons_select on public.comparisons
    for select using (auth.uid() = user_id);
  create policy comparisons_insert on public.comparisons
    for insert with check (auth.uid() = user_id);
  create policy comparisons_update on public.comparisons
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy comparisons_delete on public.comparisons
    for delete using (auth.uid() = user_id);
end $$;
