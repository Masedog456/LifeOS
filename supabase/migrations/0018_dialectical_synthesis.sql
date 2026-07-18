-- LIFEOS-023 — Dialectical synthesis & tension resolution.
--
-- Turns a dialogue into genuine dialectical reasoning: explicitly represented
-- TENSIONS (between beliefs, assumptions, evidence, perspectives) and candidate
-- SYNTHESES that integrate them. Two additive, own-rows tables — one jsonb row
-- per tension, one per synthesis — mirroring the dialogue engine's shape.
-- Confidence is stored as a jsonb object with four independent axes and is never
-- collapsed to a scalar. Nothing here mutates a belief, concept, research
-- project, or dialogue: integration into those subsystems is always an explicit
-- user action recorded as provenance. Additive and rerunnable; migrations
-- 0001–0017 are untouched; existing data preserved; RLS enforced.

-- 1. Tensions -----------------------------------------------------------------
create table if not exists public.tensions (
  id                   uuid primary key,
  user_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dialogue_id          uuid not null,             -- the dialogue this tension belongs to (loose ref)
  kind                 text not null default 'conflicting_beliefs',
  title                text not null default '',
  thesis               text not null default '',
  antithesis           text not null default '',
  thesis_refs          jsonb not null default '[]'::jsonb,   -- records the thesis rests on
  antithesis_refs      jsonb not null default '[]'::jsonb,   -- records the antithesis rests on
  evidence             jsonb not null default '[]'::jsonb,   -- DialecticEvidenceLink[]
  confidence           jsonb not null default '{}'::jsonb,   -- {factual,logical,evidential,experiential}
  unresolved_questions jsonb not null default '[]'::jsonb,
  status               text not null default 'open',         -- open|under_synthesis|resolved|dissolved|accepted_as_paradox
  origin               text not null default 'detected',     -- detected|user
  detail               text,
  signature            text not null default '',             -- stable dedupe key (kind + sorted member ids)
  history              jsonb not null default '[]'::jsonb,   -- append-only change log
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists tensions_user_created_idx  on public.tensions (user_id, created_at desc);
create index if not exists tensions_user_updated_idx  on public.tensions (user_id, updated_at desc);
create index if not exists tensions_dialogue_idx      on public.tensions (user_id, dialogue_id);

alter table public.tensions enable row level security;

do $$
begin
  drop policy if exists tensions_select on public.tensions;
  drop policy if exists tensions_insert on public.tensions;
  drop policy if exists tensions_update on public.tensions;
  drop policy if exists tensions_delete on public.tensions;
  create policy tensions_select on public.tensions
    for select using (auth.uid() = user_id);
  create policy tensions_insert on public.tensions
    for insert with check (auth.uid() = user_id);
  create policy tensions_update on public.tensions
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy tensions_delete on public.tensions
    for delete using (auth.uid() = user_id);
end $$;

-- 2. Syntheses ----------------------------------------------------------------
create table if not exists public.syntheses (
  id                    uuid primary key,
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dialogue_id           uuid not null,             -- the dialogue this synthesis belongs to (loose ref)
  tension_ids           jsonb not null default '[]'::jsonb,  -- one or more tensions integrated (loose refs)
  statement             text not null default '',
  preserved_insights    jsonb not null default '[]'::jsonb,
  discarded_assumptions jsonb not null default '[]'::jsonb,
  common_ground         jsonb not null default '[]'::jsonb,
  remaining_uncertainty jsonb not null default '[]'::jsonb,
  confidence            jsonb not null default '{}'::jsonb,  -- four independent axes, never collapsed
  evidence_links        jsonb not null default '[]'::jsonb,  -- DialecticEvidenceLink[]
  status                text not null default 'candidate',   -- candidate|accepted|rejected|superseded
  origin                text not null default 'generated',   -- generated|user
  supersedes_id         uuid,                                -- the synthesis this one supersedes (loose ref)
  revisions             jsonb not null default '[]'::jsonb,  -- append-only revision history
  outcomes              jsonb not null default '[]'::jsonb,  -- records this synthesis was integrated into (provenance)
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists syntheses_user_created_idx  on public.syntheses (user_id, created_at desc);
create index if not exists syntheses_user_updated_idx  on public.syntheses (user_id, updated_at desc);
create index if not exists syntheses_dialogue_idx      on public.syntheses (user_id, dialogue_id);

alter table public.syntheses enable row level security;

do $$
begin
  drop policy if exists syntheses_select on public.syntheses;
  drop policy if exists syntheses_insert on public.syntheses;
  drop policy if exists syntheses_update on public.syntheses;
  drop policy if exists syntheses_delete on public.syntheses;
  create policy syntheses_select on public.syntheses
    for select using (auth.uid() = user_id);
  create policy syntheses_insert on public.syntheses
    for insert with check (auth.uid() = user_id);
  create policy syntheses_update on public.syntheses
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy syntheses_delete on public.syntheses
    for delete using (auth.uid() = user_id);
end $$;
