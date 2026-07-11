"use client";

import { useState } from "react";
import { signInWithEmail, signOut, useAuth } from "@/lib/authStore";

/**
 * Minimal, calm authentication control shown in the nav.
 *  - Supabase unconfigured → renders nothing (local-only mode).
 *  - Signed out → "Sign in" opening a small email magic-link form.
 *  - Signed in → the email + "Sign out".
 * No account-settings area.
 */
export default function AuthControl() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");

  if (!auth.configured) return null; // local-only mode: nothing to show
  if (auth.loading) return <span className="text-xs text-zinc-400">…</span>;

  if (auth.email) {
    return (
      <span className="flex items-center gap-2 text-xs text-zinc-500">
        <span className="hidden max-w-[12rem] truncate sm:inline" title={auth.email}>
          {auth.email}
        </span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="underline underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Sign out
        </button>
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-full border border-black/[.12] px-3 py-1 text-xs font-medium hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]"
      >
        Sign in
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-black/[.10] bg-white p-4 shadow-lg dark:border-white/[.12] dark:bg-zinc-900">
          <p className="text-sm font-medium">Sign in to sync across devices</p>
          <p className="mt-1 text-xs text-zinc-500">
            We&apos;ll email you a secure sign-in link. Your data stays private to
            your account.
          </p>

          {auth.phase === "sent" ? (
            <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              Check your email for a sign-in link.
            </p>
          ) : (
            <form
              className="mt-3 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void signInWithEmail(email);
              }}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]"
              />
              <button
                type="submit"
                disabled={auth.phase === "sending" || !email.trim()}
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {auth.phase === "sending" ? "Sending…" : "Email me a link"}
              </button>
              {auth.phase === "error" && (
                <p className="text-xs text-red-500">{auth.error ?? "Sign-in failed."}</p>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
