-- LIFEOS-008 — PDF ingestion fields.
--
-- Additive and rerunnable: only ADDs nullable jsonb columns to `sources`
-- for PDF provenance. The PDF binary itself is NOT stored (extraction is
-- client-side, text-only), so no Storage bucket or policy is required.
-- Existing rows/data, other tables, RLS policies, and triggers are
-- untouched. Re-running is a no-op.

alter table public.sources
  add column if not exists pdf_meta         jsonb,
  add column if not exists page_map         jsonb,
  add column if not exists extraction_status text;

-- RLS on public.sources (from 0001) already restricts every column to the
-- owning user. No policy changes needed.
