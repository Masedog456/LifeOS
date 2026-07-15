"use client";

import { useState } from "react";
import type { PracticeCandidate } from "@/types/mvp";
import { editPracticeWording, setPracticeStatus } from "@/lib/mvpStore";

const STATUS_LABEL: Record<PracticeCandidate["status"], string> = {
  proposed: "Proposed", accepted: "Accepted", paused: "Paused", completed: "Completed", rejected: "Rejected",
};

function PracticeRow({ practice, onAccept }: { practice: PracticeCandidate; onAccept?: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(practice.userWording || practice.title);

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{practice.userWording || practice.title}</p>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-300">{practice.description}</p>
          <p className="mt-1 text-xs text-zinc-400">
            {STATUS_LABEL[practice.status]}
            {practice.cadence && ` · suggested cadence: ${practice.cadence}`}
            {" · "}why: {practice.rationale}
          </p>
        </div>
      </div>

      {editing ? (
        <div className="mt-2">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-black/[.12] bg-transparent p-2 text-sm outline-none dark:border-white/[.15]" />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => { editPracticeWording(practice.id, draft); setEditing(false); }} className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">Save wording</button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-full px-3 py-1 text-xs text-zinc-400">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
          {practice.status === "proposed" && (
            <>
              <button type="button" onClick={() => { setPracticeStatus(practice.id, "accepted"); onAccept?.(practice.id); }} className="rounded-full border border-black/[.12] px-2.5 py-1 hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]">Accept</button>
              <button type="button" onClick={() => setEditing(true)} className="rounded-full border border-black/[.12] px-2.5 py-1 hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]">Rewrite</button>
              <button type="button" onClick={() => setPracticeStatus(practice.id, "rejected")} className="rounded-full px-2.5 py-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">Reject</button>
            </>
          )}
          {practice.status === "accepted" && (
            <>
              <button type="button" onClick={() => setPracticeStatus(practice.id, "paused")} className="rounded-full px-2.5 py-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">Pause</button>
              <button type="button" onClick={() => setPracticeStatus(practice.id, "completed")} className="rounded-full px-2.5 py-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">Mark done</button>
              <button type="button" onClick={() => setEditing(true)} className="rounded-full px-2.5 py-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">Rewrite</button>
            </>
          )}
          {practice.status === "paused" && (
            <button type="button" onClick={() => setPracticeStatus(practice.id, "accepted")} className="rounded-full px-2.5 py-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">Resume</button>
          )}
        </div>
      )}
    </li>
  );
}

export default function PracticeList({ practices, onAccept }: { practices: PracticeCandidate[]; onAccept?: (id: string) => void }) {
  if (practices.length === 0) return null;
  return (
    <ul className="flex flex-col divide-y divide-black/[.05] dark:divide-white/[.06]">
      {practices.map((p) => <PracticeRow key={p.id} practice={p} onAccept={onAccept} />)}
    </ul>
  );
}
