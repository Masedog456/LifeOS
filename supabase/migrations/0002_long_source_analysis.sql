-- LIFEOS-007 — Long-source analysis fields.
--
-- Additive and rerunnable: only ADDs nullable/defaulted columns to the
-- existing `sources` table. Does not touch existing rows' data, other
-- tables, RLS policies, or the immutability triggers. Existing production
-- data is preserved; re-running is a no-op.

alter table public.sources
  add column if not exists chunk_results jsonb not null default '[]'::jsonb,
  add column if not exists analysis      jsonb,
  add column if not exists stages        jsonb;

-- (RLS on public.sources from 0001 already covers these columns — a user
--  can only read/write their own source rows. No policy changes needed.)
