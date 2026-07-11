/**
 * Supabase browser client factory.
 *
 * Only the public URL and anon key are ever read here — both are safe to
 * expose client-side (the anon key is public by design; RLS is what
 * protects data). The service-role key and ANTHROPIC_API_KEY are NEVER
 * referenced in client code.
 *
 * If neither env var is set, the app runs in local-only mode and this
 * returns null (no crash). If exactly one is set, that's a misconfiguration
 * and we throw a clear, human-readable error.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getSupabaseClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url && !anon) {
    cached = null; // local-only mode
    return cached;
  }
  if (!url || !anon) {
    throw new Error(
      "LifeOS: set BOTH NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "(or neither, to run in local-only mode). See .env.example.",
    );
  }

  cached = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return cached;
}
