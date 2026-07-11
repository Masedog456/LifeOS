"use client";

import { useEffect } from "react";
import { initRemote } from "@/lib/persistence";
import { replaceState } from "@/lib/mvpStore";

/**
 * Runs once client-side after local hydration: ensures auth and performs
 * first-run migration / remote adoption when Supabase is configured. A no-op
 * (local-only mode) when it isn't.
 */
export default function PersistenceBootstrap() {
  useEffect(() => {
    void initRemote(replaceState);
  }, []);
  return null;
}
