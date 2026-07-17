-- LIFEOS-021 — Unified graph & incremental persistence.
--
-- This sprint's knowledge-graph layer is DERIVED (deterministic, in-memory over
-- existing records) and needs no tables. What the database gains here supports
-- INCREMENTAL sync/load:
--   1. `updated_at` indexes on the per-domain tables, so an incremental loader
--      can fetch only rows changed since a cursor (WHERE updated_at > cursor).
--   2. a `sync_meta` table recording, per user + domain, the last-synced cursor.
-- Everything is ADDITIVE and backward-compatible: no existing table, row, RLS
-- policy, or migration (0001–0015) is modified. Existing data is preserved, and
-- the whole-state sync path keeps working unchanged. RLS is enforced on the new
-- table exactly like every other.

-- 1. updated_at indexes (per user) for incremental loads. `if not exists` makes
--    this safe to re-run and harmless where an index already exists.
create index if not exists beliefs_user_updated_idx            on public.beliefs (user_id, updated_at desc);
create index if not exists sources_user_added_idx              on public.sources (user_id, added_at desc);
create index if not exists comparisons_user_created_idx        on public.comparisons (user_id, created_at desc);
create index if not exists inquiries_user_updated_idx          on public.inquiries (user_id, updated_at desc);
create index if not exists megathreads_user_updated_idx        on public.megathreads (user_id, updated_at desc);
create index if not exists reflections_user_created_idx        on public.reflections (user_id, created_at desc);
create index if not exists practices_user_updated_idx          on public.practices (user_id, updated_at desc);
create index if not exists reasonings_user_updated_idx         on public.reasonings (user_id, updated_at desc);
create index if not exists decisions_user_updated_idx          on public.decisions (user_id, updated_at desc);
create index if not exists formation_sessions_user_updated_idx on public.formation_sessions (user_id, updated_at desc);
create index if not exists concepts_user_updated_idx           on public.concepts (user_id, updated_at desc);
create index if not exists principles_user_updated_idx         on public.principles (user_id, updated_at desc);
create index if not exists frameworks_user_updated_idx         on public.frameworks (user_id, updated_at desc);
create index if not exists knowledge_projects_user_updated_idx on public.knowledge_projects (user_id, updated_at desc);
create index if not exists research_projects_user_updated_idx  on public.research_projects (user_id, updated_at desc);

-- 2. Per-user, per-domain sync cursors (incremental-load bookkeeping).
create table if not exists public.sync_meta (
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  domain         text not null,                 -- store-state key, e.g. 'beliefs'
  last_synced_at timestamptz not null default now(),
  cursor         text,                           -- opaque cursor (e.g. max updated_at seen)
  primary key (user_id, domain)
);

alter table public.sync_meta enable row level security;

do $$
begin
  drop policy if exists sync_meta_select on public.sync_meta;
  drop policy if exists sync_meta_insert on public.sync_meta;
  drop policy if exists sync_meta_update on public.sync_meta;
  drop policy if exists sync_meta_delete on public.sync_meta;
  create policy sync_meta_select on public.sync_meta
    for select using (auth.uid() = user_id);
  create policy sync_meta_insert on public.sync_meta
    for insert with check (auth.uid() = user_id);
  create policy sync_meta_update on public.sync_meta
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy sync_meta_delete on public.sync_meta
    for delete using (auth.uid() = user_id);
end $$;
