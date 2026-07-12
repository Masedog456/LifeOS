-- LIFEOS-012 — Megathreads & longitudinal knowledge.
--
-- A Megathread is a living, provenance-grounded VIEW over existing records —
-- it stores member references (not copies of source text), curation state
-- (pinned/excluded), a cautious synthesis, questions, notes, and an
-- append-only revision log. The timeline is a read-model derived at render
-- time, so it is never stored and never rewrites history. The whole record is
-- one row with jsonb columns (mirroring `comparisons`/`inquiries`). Additive
-- and rerunnable; migrations 0001–0006 are untouched; existing data
-- preserved; RLS enforced.

create table if not exists public.megathreads (
  id                   uuid primary key,
  user_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title                text not null default '',
  description          text,
  status               text not null default 'active',   -- active|dormant|archived
  seed_type            text not null default 'manual',    -- concept|belief|question|source|comparison|inquiry|manual
  seed_id              text,
  seed_label           text,
  members              jsonb not null default '[]'::jsonb, -- references to existing records (no text copies)
  pinned               jsonb not null default '[]'::jsonb,
  excluded             jsonb not null default '[]'::jsonb,
  synthesis            jsonb,
  synthesis_source     text,                               -- ai|mock|user
  synthesis_evidence   jsonb,
  unresolved_questions jsonb not null default '[]'::jsonb,
  notes                text,
  judgments            jsonb not null default '[]'::jsonb,  -- append-only human verdicts
  revisions            jsonb not null default '[]'::jsonb,  -- append-only change log
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists megathreads_user_created_idx on public.megathreads (user_id, created_at desc);

alter table public.megathreads enable row level security;

-- Own-rows CRUD. Update is permitted so curation, synthesis, and append-only
-- judgments/revisions (kept inside jsonb arrays by the app) can be added to an
-- existing row; RLS still confines every operation to the owner.
do $$
begin
  drop policy if exists megathreads_select on public.megathreads;
  drop policy if exists megathreads_insert on public.megathreads;
  drop policy if exists megathreads_update on public.megathreads;
  drop policy if exists megathreads_delete on public.megathreads;
  create policy megathreads_select on public.megathreads
    for select using (auth.uid() = user_id);
  create policy megathreads_insert on public.megathreads
    for insert with check (auth.uid() = user_id);
  create policy megathreads_update on public.megathreads
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy megathreads_delete on public.megathreads
    for delete using (auth.uid() = user_id);
end $$;
