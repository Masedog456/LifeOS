"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { pendingProposals, useStore } from "@/lib/mvpStore";
import SyncStatus from "@/components/SyncStatus";
import AuthControl from "@/components/AuthControl";

const LINKS = [
  { href: "/", label: "Capture" },
  { href: "/library", label: "Library" },
  { href: "/compare", label: "Compare" },
  { href: "/inquiry", label: "Inquiry" },
  { href: "/threads", label: "Threads" },
  { href: "/reason", label: "Reason" },
  { href: "/decisions", label: "Decide" },
  { href: "/formation", label: "Reflect" },
  { href: "/world", label: "World" },
  { href: "/review", label: "Review" },
  { href: "/inbox", label: "Inbox" },
  { href: "/constitution", label: "Constitution" },
];

export default function Nav() {
  const pathname = usePathname();
  const state = useStore();
  const pending = pendingProposals(state).length;

  return (
    <nav className="w-full border-b border-black/[.06] dark:border-white/[.08]">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          LifeOS
        </Link>
        <div className="hidden sm:block">
          <SyncStatus />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1 text-sm">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 transition-colors ${
                  active
                    ? "bg-black/[.06] font-medium dark:bg-white/[.10]"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {link.label}
                {link.href === "/inbox" && pending > 0 && (
                  <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-900 px-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                    {pending}
                  </span>
                )}
              </Link>
            );
          })}
          <div className="ml-1">
            <AuthControl />
          </div>
        </div>
      </div>
    </nav>
  );
}
