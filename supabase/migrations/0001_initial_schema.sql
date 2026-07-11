-- LIFEOS-004 — Durable persistence schema.
--
-- Only the tables the currently working product needs (LIFEOS-002 belief
-- ledger + LIFEOS-003 knowledge library). No speculative ontology tables.
--
-- Ownership model: every personal row carries user_id, defaulting to the
-- authenticated user (auth.uid()). Row-level security ensures a user can
-- only ever read or write their own rows. Anonymous auth is sufficient for
-- the single-user MVP; email auth works identically (same auth.uid()).
--
-- Immutability: original source text, captured passages, and saved quotes
-- must never be silently overwritten. Enforced at the database level
-- (triggers + append-only RLS), not merely in the app.

-- gen_random_uuid() is available in Supabase (pgcrypto).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.sources (
  id               uuid primary key,
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type             text not null,
  input            text not null,
  title            text not null,
  author           text,
  origin           text,
  status           text not null default 'unread',
  processing_state text not null default 'captured',
  processing_error text,
  original_text    text not null default '',
  chunks           jsonb not null default '[]'::jsonb,
  summary          text,
  key_concepts     jsonb not null default '[]'::jsonb,
  candidate_beliefs jsonb not null default '[]'::jsonb,
  derived_source   text,
  added_at         timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create table if not exists public.captures (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text       text not null,
  source_id  uuid references public.sources(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.proposals (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  capture_id uuid not null references public.captures(id) on delete cascade,
  claim      text not null,
  theme      text,
  span_start integer,
  span_end   integer,
  source     text not null,            -- 'ai' | 'mock'
  resolved   boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.beliefs (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  capture_id  uuid references public.captures(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null,
  text        text not null,
  theme       text,
  status      text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Append-only wording history for a belief (the "thread").
create table if not exists public.belief_revisions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  belief_id  uuid not null references public.beliefs(id) on delete cascade,
  seq        integer not null,
  text       text not null,
  reason     text not null,
  at         timestamptz not null default now(),
  unique (belief_id, seq)
);

-- Append-only human judgments on a belief.
create table if not exists public.user_judgments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  belief_id  uuid not null references public.beliefs(id) on delete cascade,
  seq        integer not null,
  decision   text not null,
  note       text,
  at         timestamptz not null default now(),
  unique (belief_id, seq)
);

-- Saved verbatim quotes (deduped per source; never overwritten).
create table if not exists public.saved_quotes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_id  uuid not null references public.sources(id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now(),
  unique (source_id, text)
);

-- ---------------------------------------------------------------------------
-- Indexes — only for queries the current product runs
-- ---------------------------------------------------------------------------

create index if not exists sources_user_created_idx   on public.sources (user_id, created_at desc);
create index if not exists sources_type_idx           on public.sources (user_id, type);
create index if not exists captures_user_created_idx  on public.captures (user_id, created_at desc);
create index if not exists captures_source_idx        on public.captures (source_id);
create index if not exists proposals_capture_idx      on public.proposals (capture_id);
create index if not exists proposals_status_idx       on public.proposals (user_id, resolved);
create index if not exists proposals_created_idx      on public.proposals (user_id, created_at desc);
create index if not exists beliefs_user_created_idx   on public.beliefs (user_id, created_at desc);
create index if not exists beliefs_status_idx         on public.beliefs (user_id, status);
create index if not exists beliefs_capture_idx        on public.beliefs (capture_id);
create index if not exists belief_revisions_belief_idx on public.belief_revisions (belief_id);
create index if not exists user_judgments_belief_idx  on public.user_judgments (belief_id);
create index if not exists saved_quotes_source_idx    on public.saved_quotes (source_id);

-- ---------------------------------------------------------------------------
-- Immutability triggers (original text + capture text cannot be overwritten)
-- ---------------------------------------------------------------------------

create or replace function public.prevent_source_text_overwrite()
returns trigger language plpgsql as $$
begin
  if old.original_text <> '' and new.original_text is distinct from old.original_text then
    raise exception 'original_text is immutable once set';
  end if;
  return new;
end;
$$;

drop trigger if exists sources_immutable_text on public.sources;
create trigger sources_immutable_text
  before update on public.sources
  for each row execute function public.prevent_source_text_overwrite();

create or replace function public.prevent_capture_text_overwrite()
returns trigger language plpgsql as $$
begin
  if new.text is distinct from old.text then
    raise exception 'capture text is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists captures_immutable_text on public.captures;
create trigger captures_immutable_text
  before update on public.captures
  for each row execute function public.prevent_capture_text_overwrite();

-- ---------------------------------------------------------------------------
-- Row-level security — a user can only touch their own rows
-- ---------------------------------------------------------------------------

alter table public.sources          enable row level security;
alter table public.captures         enable row level security;
alter table public.proposals        enable row level security;
alter table public.beliefs          enable row level security;
alter table public.belief_revisions enable row level security;
alter table public.user_judgments   enable row level security;
alter table public.saved_quotes     enable row level security;

-- Full CRUD (own rows) for the mutable working tables.
do $$
declare t text;
begin
  foreach t in array array['sources','captures','proposals','beliefs'] loop
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

-- Append-only tables: select + insert only (no update/delete policies, so
-- those operations are denied — history cannot be rewritten). Cascade
-- deletes from a parent belief still work (they bypass row policies).
do $$
declare t text;
begin
  foreach t in array array['belief_revisions','user_judgments','saved_quotes'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select using (auth.uid() = user_id)', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (auth.uid() = user_id)', t, t);
  end loop;
end $$;
