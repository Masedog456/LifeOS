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
--
-- IMPORTANT (hotfix): the incremental-load indexes are a PERFORMANCE optimization
-- layered over the feature tables created in migrations 0001–0015. Each such
-- table is created by its own feature migration; this migration must NOT assume
-- every one of them has been applied, and it must NEVER create a placeholder
-- domain table. So each index below is created only if its target table AND
-- columns already exist. A database that has not yet applied a given feature
-- migration (e.g. 0006 `inquiries`) simply skips that one index instead of
-- aborting the whole migration — apply the missing feature migration to get it.
-- This is what makes the migration safe to (re-)run on any partially-migrated
-- database, including one where an earlier attempt of this file already created
-- the first few indexes before erroring on a missing table.

-- 1. updated_at (incremental-load) indexes, one per synced domain table. Each is
--    guarded on the existence of the table + both indexed columns, and uses
--    `if not exists`, so this block is fully idempotent and never references a
--    table that does not exist. (table, timestamp column, index name)
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('beliefs',            'updated_at', 'beliefs_user_updated_idx'),
      ('sources',            'added_at',   'sources_user_added_idx'),
      ('comparisons',        'created_at', 'comparisons_user_created_idx'),
      ('inquiries',          'updated_at', 'inquiries_user_updated_idx'),
      ('megathreads',        'updated_at', 'megathreads_user_updated_idx'),
      ('reflections',        'created_at', 'reflections_user_created_idx'),
      ('practices',          'updated_at', 'practices_user_updated_idx'),
      ('reasonings',         'updated_at', 'reasonings_user_updated_idx'),
      ('decisions',          'updated_at', 'decisions_user_updated_idx'),
      ('formation_sessions', 'updated_at', 'formation_sessions_user_updated_idx'),
      ('concepts',           'updated_at', 'concepts_user_updated_idx'),
      ('principles',         'updated_at', 'principles_user_updated_idx'),
      ('frameworks',         'updated_at', 'frameworks_user_updated_idx'),
      ('knowledge_projects', 'updated_at', 'knowledge_projects_user_updated_idx'),
      ('research_projects',  'updated_at', 'research_projects_user_updated_idx')
    ) as t(tbl, ts_col, idx_name)
  loop
    if exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = r.tbl and column_name = 'user_id'
        )
       and exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = r.tbl and column_name = r.ts_col
        )
    then
      execute format(
        'create index if not exists %I on public.%I (user_id, %I desc)',
        r.idx_name, r.tbl, r.ts_col
      );
    else
      raise notice 'LIFEOS-021: skipping index % — public.% (user_id, %) not present; apply that feature migration to enable incremental indexing for it.',
        r.idx_name, r.tbl, r.ts_col;
    end if;
  end loop;
end $$;

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
