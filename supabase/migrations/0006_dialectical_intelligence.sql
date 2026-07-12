-- LIFEOS-011 — Dialectical intelligence.
--
-- An inquiry is a saved, evolving reasoning aid: a structured dialectic over
-- a question and 1–5 materials (sources / a belief / a saved comparison /
-- passages). The whole record is stored as one row with jsonb columns
-- (mirroring `comparisons`), including its append-only `history` of prior
-- results and its append-only human `judgments`. Additive and rerunnable;
-- migrations 0001–0005 are untouched; existing data preserved; RLS enforced.

create table if not exists public.inquiries (
  id                     uuid primary key,
  user_id                uuid not null default auth.uid() references auth.users(id) on delete cascade,
  question               text not null default '',
  inputs                 jsonb not null default '[]'::jsonb,
  source_ids             jsonb not null default '[]'::jsonb,
  belief_ids             jsonb not null default '[]'::jsonb,
  comparison_ids         jsonb not null default '[]'::jsonb,
  evidence               jsonb not null default '[]'::jsonb,
  result                 jsonb not null default '{}'::jsonb,
  history                jsonb not null default '[]'::jsonb, -- append-only prior results
  ai_model               text not null default 'mock',
  source                 text not null default 'mock',       -- 'ai' | 'mock'
  coverage               text,                               -- 'sampled' | 'full' | null
  partial                boolean not null default false,
  verified               boolean not null default false,
  status                 text not null default 'open',       -- open|provisional|unresolved|resolved
  provisional_conclusion text,
  judgments              jsonb not null default '[]'::jsonb,  -- append-only human verdicts
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists inquiries_user_created_idx on public.inquiries (user_id, created_at desc);

alter table public.inquiries enable row level security;

-- Own-rows CRUD. Update is permitted so append-only history/judgments (kept
-- inside jsonb arrays by the app) and the user's provisional conclusion can be
-- added to an existing row; RLS still confines every operation to the owner.
do $$
begin
  drop policy if exists inquiries_select on public.inquiries;
  drop policy if exists inquiries_insert on public.inquiries;
  drop policy if exists inquiries_update on public.inquiries;
  drop policy if exists inquiries_delete on public.inquiries;
  create policy inquiries_select on public.inquiries
    for select using (auth.uid() = user_id);
  create policy inquiries_insert on public.inquiries
    for insert with check (auth.uid() = user_id);
  create policy inquiries_update on public.inquiries
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy inquiries_delete on public.inquiries
    for delete using (auth.uid() = user_id);
end $$;
