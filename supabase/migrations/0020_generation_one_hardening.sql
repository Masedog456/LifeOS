-- LIFEOS-025 — Generation 1 hardening, coherence & daily use.
--
-- The only new persistence Generation 1 hardening needs is per-user
-- PREFERENCES (currently onboarding state), so the first-run tour follows the
-- user across devices. Save/sync diagnostics, system-health reporting, and
-- integrity findings are all DERIVED deterministically from existing data at
-- view time — persisting them would duplicate state, so no tables are added
-- for them (per the sprint's "avoid tables if existing structures are
-- sufficient"). One additive key/value table with own-rows RLS; migrations
-- 0001–0019 are untouched; existing data preserved.

create table if not exists public.user_prefs (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key        text not null,                       -- e.g. 'prefs'
  value      jsonb not null default '{}'::jsonb,  -- e.g. { "onboarding": "done" }
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create index if not exists user_prefs_user_updated_idx on public.user_prefs (user_id, updated_at desc);

alter table public.user_prefs enable row level security;

do $$
begin
  drop policy if exists user_prefs_select on public.user_prefs;
  drop policy if exists user_prefs_insert on public.user_prefs;
  drop policy if exists user_prefs_update on public.user_prefs;
  drop policy if exists user_prefs_delete on public.user_prefs;
  create policy user_prefs_select on public.user_prefs
    for select using (auth.uid() = user_id);
  create policy user_prefs_insert on public.user_prefs
    for insert with check (auth.uid() = user_id);
  create policy user_prefs_update on public.user_prefs
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy user_prefs_delete on public.user_prefs
    for delete using (auth.uid() = user_id);
end $$;
