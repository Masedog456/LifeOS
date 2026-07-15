-- LIFEOS-015 — Semantic retrieval (pgvector) & durable embedding index.
--
-- Optional, additive layer. Deterministic retrieval keeps working with no
-- embeddings; this table only stores per-record vectors for durable/cross-
-- device recall and future server-side similarity. Own-row RLS ensures no
-- cross-user similarity results. Additive and rerunnable; migrations
-- 0001–0009 are untouched; existing data preserved.

-- Enable pgvector safely (available on Supabase). No-op if already enabled.
create extension if not exists vector;

create table if not exists public.embeddings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  record_id     text not null,          -- app record id (e.g. `belief:<id>`)
  type          text not null,          -- EmbeddableType
  source_id     uuid,                   -- when the record belongs to a source
  content_hash  text not null,          -- idempotency: unchanged content ⇒ skip
  provider      text not null default 'local',
  model         text not null default 'lexical-v1',
  dimensions    integer not null,
  -- Dimensionless `vector` column so local (128-d) and provider (e.g. 1536-d)
  -- embeddings can coexist; a fixed-dim ANN index can be added later once a
  -- single provider/model is chosen at scale.
  embedding     vector,
  generated_at  timestamptz not null default now(),
  unique (user_id, record_id)
);

create index if not exists embeddings_user_record_idx on public.embeddings (user_id, record_id);
create index if not exists embeddings_user_type_idx   on public.embeddings (user_id, type);

alter table public.embeddings enable row level security;

-- Own-rows CRUD (update needed for re-embedding a changed record in place).
do $$
begin
  drop policy if exists embeddings_select on public.embeddings;
  drop policy if exists embeddings_insert on public.embeddings;
  drop policy if exists embeddings_update on public.embeddings;
  drop policy if exists embeddings_delete on public.embeddings;
  create policy embeddings_select on public.embeddings
    for select using (auth.uid() = user_id);
  create policy embeddings_insert on public.embeddings
    for insert with check (auth.uid() = user_id);
  create policy embeddings_update on public.embeddings
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy embeddings_delete on public.embeddings
    for delete using (auth.uid() = user_id);
end $$;

-- User-scoped similarity RPC. SECURITY INVOKER (default) so RLS applies and a
-- caller can only ever match THEIR OWN vectors — no cross-user results.
create or replace function public.match_embeddings(
  query_embedding vector,
  match_count int default 10
)
returns table (record_id text, type text, source_id uuid, similarity float)
language sql stable
as $$
  select e.record_id, e.type, e.source_id,
         1 - (e.embedding <=> query_embedding) as similarity
  from public.embeddings e
  where e.user_id = auth.uid()
    and e.embedding is not null
  order by e.embedding <=> query_embedding
  limit match_count;
$$;
