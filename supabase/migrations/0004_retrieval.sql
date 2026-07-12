-- LIFEOS-009 — Retrieval feedback.
--
-- Retrieval itself is deterministic and in-memory (no index table, no
-- pgvector). Only user FEEDBACK on surfaced results is persisted, so it can
-- tune ranking across devices. Additive and rerunnable; migrations
-- 0001–0003 are untouched; existing data preserved.

create table if not exists public.retrieval_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  record_id   text not null,
  verdict     text not null,
  at          timestamptz not null default now(),
  snooze_until timestamptz,
  unique (user_id, record_id, at)
);

create index if not exists retrieval_feedback_user_idx on public.retrieval_feedback (user_id, record_id);

alter table public.retrieval_feedback enable row level security;

-- Append-only + own-rows-only (select + insert; no update/delete policies).
do $$
begin
  drop policy if exists retrieval_feedback_select on public.retrieval_feedback;
  drop policy if exists retrieval_feedback_insert on public.retrieval_feedback;
  create policy retrieval_feedback_select on public.retrieval_feedback
    for select using (auth.uid() = user_id);
  create policy retrieval_feedback_insert on public.retrieval_feedback
    for insert with check (auth.uid() = user_id);
end $$;
