-- LIFEOS-014 — Reasoning engine.
--
-- A reasoning query is a saved higher-order analysis over the user's existing
-- knowledge (support/contradiction/influence/assumption/impact/... modes). The
-- grounded result comes from deterministic passes; an AI layer is added on top.
-- Stored as one jsonb-bearing row (mirroring comparisons/inquiries), including
-- its append-only `history` of prior results and append-only `judgments`. The
-- evidence field holds REFERENCES to existing records, not copies of source
-- text. Additive and rerunnable; migrations 0001–0008 are untouched; existing
-- data preserved; RLS enforced.

create table if not exists public.reasonings (
  id                     uuid primary key,
  user_id                uuid not null default auth.uid() references auth.users(id) on delete cascade,
  question               text not null default '',
  mode                   text not null default 'open_inquiry',
  scope                  jsonb not null default '{"kind":"all"}'::jsonb,
  evidence               jsonb not null default '[]'::jsonb,   -- references to existing records
  result                 jsonb not null default '{}'::jsonb,
  history                jsonb not null default '[]'::jsonb,   -- append-only prior results
  ai_model               text not null default 'mock',
  source                 text not null default 'mock',          -- ai|mock
  coverage               text,                                  -- sampled|full|null
  partial                boolean not null default false,
  verified               boolean not null default false,
  status                 text not null default 'open',          -- open|provisional|resolved
  provisional_conclusion text,
  judgments              jsonb not null default '[]'::jsonb,    -- append-only human verdicts
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists reasonings_user_created_idx on public.reasonings (user_id, created_at desc);

alter table public.reasonings enable row level security;

-- Own-rows CRUD. Update is permitted so append-only history/judgments (kept
-- inside jsonb arrays by the app) and the provisional conclusion can be added
-- to an existing row; RLS still confines every operation to the owner.
do $$
begin
  drop policy if exists reasonings_select on public.reasonings;
  drop policy if exists reasonings_insert on public.reasonings;
  drop policy if exists reasonings_update on public.reasonings;
  drop policy if exists reasonings_delete on public.reasonings;
  create policy reasonings_select on public.reasonings
    for select using (auth.uid() = user_id);
  create policy reasonings_insert on public.reasonings
    for insert with check (auth.uid() = user_id);
  create policy reasonings_update on public.reasonings
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy reasonings_delete on public.reasonings
    for delete using (auth.uid() = user_id);
end $$;
