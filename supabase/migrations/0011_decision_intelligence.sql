-- LIFEOS-016 — Decision intelligence.
--
-- A decision is a structured record the USER builds and resolves: options,
-- editable criteria + optional weights, ratings, constraints, assumptions, an
-- evidence packet (references to existing records — never copied source
-- text), a validated analysis with append-only history, the user's own
-- provisional/final choice + rationale + stated confidence, append-only
-- judgments/revisions/outcome-reviews, and a freshness fingerprint. LifeOS
-- never chooses automatically. One jsonb-bearing row per decision (mirroring
-- comparisons/inquiries/reasonings). Additive and rerunnable; migrations
-- 0001–0010 are untouched; existing data preserved; RLS enforced.

create table if not exists public.decisions (
  id                 uuid primary key,
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title              text not null default '',
  question           text not null default '',
  status             text not null default 'exploring', -- exploring|narrowed|decided|deferred|abandoned
  options            jsonb not null default '[]'::jsonb,
  criteria           jsonb not null default '[]'::jsonb,
  ratings            jsonb not null default '{}'::jsonb,
  constraints        jsonb not null default '[]'::jsonb,
  assumptions        jsonb not null default '[]'::jsonb,
  seed_refs          jsonb not null default '[]'::jsonb,
  evidence           jsonb not null default '[]'::jsonb,  -- references, not text copies
  analysis           jsonb,
  analysis_source    text,                                 -- ai|mock
  history            jsonb not null default '[]'::jsonb,   -- append-only prior analyses
  provisional_choice text,
  final_choice       text,                                 -- set only by explicit user action
  rationale          text,
  user_confidence    text,                                 -- low|medium|high, stated by the user
  judgments          jsonb not null default '[]'::jsonb,   -- append-only human verdicts
  revisions          jsonb not null default '[]'::jsonb,   -- append-only change log
  outcome_reviews    jsonb not null default '[]'::jsonb,   -- append-only reflective reviews
  fingerprint        jsonb,
  sensitive          text,                                 -- caution text for sensitive topics
  ai_model           text not null default 'mock',
  source             text not null default 'mock',
  coverage           text,
  partial            boolean not null default false,
  verified           boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists decisions_user_created_idx on public.decisions (user_id, created_at desc);

alter table public.decisions enable row level security;

-- Own-rows CRUD. Update is permitted so append-only history/judgments/
-- revisions/outcome-reviews (kept inside jsonb arrays by the app) and the
-- user's choices can be added to an existing row; RLS still confines every
-- operation to the owner.
do $$
begin
  drop policy if exists decisions_select on public.decisions;
  drop policy if exists decisions_insert on public.decisions;
  drop policy if exists decisions_update on public.decisions;
  drop policy if exists decisions_delete on public.decisions;
  create policy decisions_select on public.decisions
    for select using (auth.uid() = user_id);
  create policy decisions_insert on public.decisions
    for insert with check (auth.uid() = user_id);
  create policy decisions_update on public.decisions
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy decisions_delete on public.decisions
    for delete using (auth.uid() = user_id);
end $$;
