"use client";

import { useEffect } from "react";
import { initPersistence } from "@/lib/persistence";
import { replaceState } from "@/lib/mvpStore";

/**
 * Runs once client-side after local hydration: sets up the auth listener and
 * enables remote sync only for a durable email-verified session (migrating
 * local data up on first sign-in). A no-op (local-only mode) when Supabase is
 * unconfigured or the user is signed out.
 */
export default function PersistenceBootstrap() {
  useEffect(() => {
    void initPersistence(replaceState);
  }, []);
  return null;
}
