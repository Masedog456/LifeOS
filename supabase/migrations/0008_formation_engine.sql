-- LIFEOS-013 — Daily formation & review.
--
-- Three record types support the Formation Engine: reflections (immutable
-- original response + separate append-only annotations), practice candidates
-- (a status machine with append-only history), and review sessions (daily/
-- weekly, with surfaced items, judgments, and optional narrative synthesis).
-- Stored as jsonb-bearing rows (mirroring earlier sprints). Additive and
-- rerunnable; migrations 0001–0007 are untouched; existing data preserved;
-- RLS enforced. There is NO habit tracker, streak, or schedule table.

-- Reflections: the original response is immutable; a DB trigger enforces it.
create table if not exists public.reflections (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  prompt      text not null default '',
  response    text not null,
  belief_ids  jsonb not null default '[]'::jsonb,
  thread_ids  jsonb not null default '[]'::jsonb,
  source_ids  jsonb not null default '[]'::jsonb,
  context     text,
  annotations jsonb not null default '[]'::jsonb,  -- append-only later notes
  created_at  timestamptz not null default now()
);

create or replace function public.prevent_reflection_response_overwrite()
returns trigger language plpgsql as $$
begin
  if new.response is distinct from old.response then
    raise exception 'reflection response is immutable';
  end if;
  return new;
end;
$$;
drop trigger if exists reflections_immutable_response on public.reflections;
create trigger reflections_immutable_response
  before update on public.reflections
  for each row execute function public.prevent_reflection_response_overwrite();

create table if not exists public.practices (
  id           uuid primary key,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title        text not null default '',
  description  text not null default '',
  rationale    text not null default '',
  derived_from jsonb not null default '{}'::jsonb,
  cadence      text,
  status       text not null default 'proposed',  -- proposed|accepted|paused|completed|rejected
  user_wording text,
  source       text not null default 'mock',       -- ai|mock|user
  history      jsonb not null default '[]'::jsonb,  -- append-only status history
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.review_sessions (
  id                    uuid primary key,
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type                  text not null default 'daily',  -- daily|weekly|monthly
  surfaced              jsonb not null default '[]'::jsonb,
  prompts               jsonb,
  reflection_ids        jsonb not null default '[]'::jsonb,
  judgments             jsonb not null default '[]'::jsonb,
  accepted_practice_ids jsonb not null default '[]'::jsonb,
  unresolved_questions  jsonb not null default '[]'::jsonb,
  synthesis             jsonb,
  synthesis_source      text,
  alignment             jsonb,
  alignment_source      text,
  started_at            timestamptz not null default now(),
  completed_at          timestamptz
);

create index if not exists reflections_user_created_idx on public.reflections (user_id, created_at desc);
create index if not exists practices_user_created_idx    on public.practices (user_id, created_at desc);
create index if not exists reviews_user_started_idx      on public.review_sessions (user_id, started_at desc);

alter table public.reflections     enable row level security;
alter table public.practices       enable row level security;
alter table public.review_sessions enable row level security;

-- Reflections: select + insert only (no update/delete policies), so the
-- original response can never be rewritten via the API — matching the
-- append-only intent. Annotations are added by re-inserting the row? No:
-- annotations live in jsonb, so we DO need update for them, but the trigger
-- above still blocks changing `response`. Grant update for annotations only.
do $$
begin
  drop policy if exists reflections_select on public.reflections;
  drop policy if exists reflections_insert on public.reflections;
  drop policy if exists reflections_update on public.reflections;
  create policy reflections_select on public.reflections for select using (auth.uid() = user_id);
  create policy reflections_insert on public.reflections for insert with check (auth.uid() = user_id);
  create policy reflections_update on public.reflections for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
end $$;

-- Practices + review sessions: own-rows CRUD (update needed for status/history
-- and session judgments, which the app keeps append-only inside jsonb).
do $$
declare t text;
begin
  foreach t in array array['practices','review_sessions'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select using (auth.uid() = user_id)', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (auth.uid() = user_id)', t, t);
    execute format('create policy %I_update on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t, t);
    execute format('create policy %I_delete on public.%I for delete using (auth.uid() = user_id)', t, t);
  end loop;
end $$;
