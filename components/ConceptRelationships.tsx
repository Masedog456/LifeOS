"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Concept, ConceptRelationshipType } from "@/types/mvp";
import {
  approveConceptRelationship,
  proposeConceptRelationship,
  removeConceptRelationship,
  useStore,
} from "@/lib/mvpStore";
import { RELATIONSHIP_LABEL, RELATIONSHIP_TYPES, relationshipsFor } from "@/lib/world/relationships";

function name(concepts: Concept[], cid: string): string {
  return concepts.find((c) => c.id === cid)?.name ?? "?";
}

/**
 * The relationships touching one concept. Proposed edges show an explicit
 * Approve/Reject; nothing shapes the graph until a human approves. A small
 * form proposes a new edge (a proposal, not an auto-link).
 */
export default function ConceptRelationships({ concept }: { concept: Concept }) {
  const state = useStore();
  const rels = useMemo(() => relationshipsFor(state, concept.id), [state, concept.id]);
  const others = state.concepts.filter((c) => c.id !== concept.id && c.status !== "archived");

  const [toId, setToId] = useState("");
  const [type, setType] = useState<ConceptRelationshipType>("supports");
  const [reason, setReason] = useState("");

  function propose() {
    if (!toId || !reason.trim()) return;
    proposeConceptRelationship({ fromConceptId: concept.id, toConceptId: toId, type, reason, source: "user", approved: true });
    setToId(""); setReason(""); setType("supports");
  }

  const approved = rels.filter((r) => r.approved);
  const proposed = rels.filter((r) => !r.approved);

  return (
    <div className="flex flex-col gap-4">
      {approved.length > 0 && (
        <ul className="flex flex-col divide-y divide-black/[.05] text-sm dark:divide-white/[.06]">
          {approved.map((r) => {
            const outgoing = r.fromConceptId === concept.id;
            const otherId = outgoing ? r.toConceptId : r.fromConceptId;
            return (
              <li key={r.id} className="flex items-start justify-between gap-3 py-2.5">
                <span className="flex-1">
                  <span className="text-zinc-800 dark:text-zinc-200">
                    {outgoing ? "" : `${name(state.concepts, otherId)} `}
                    <span className="text-zinc-400">{RELATIONSHIP_LABEL[r.type]}</span>{" "}
                    <Link href={`/world/concept/${otherId}`} className="font-medium underline-offset-4 hover:underline">{name(state.concepts, otherId)}</Link>
                  </span>
                  {r.reason && <span className="mt-0.5 block text-xs text-zinc-400">{r.reason} · confidence: {r.confidence}</span>}
                </span>
                <button type="button" onClick={() => removeConceptRelationship(r.id)} className="shrink-0 text-[11px] text-zinc-400 hover:text-red-500">remove</button>
              </li>
            );
          })}
        </ul>
      )}

      {proposed.length > 0 && (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50/50 p-3 dark:border-amber-500/25 dark:bg-amber-500/[.06]">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Proposed — awaiting your approval</p>
          <ul className="flex flex-col divide-y divide-black/[.05] text-sm dark:divide-white/[.06]">
            {proposed.map((r) => (
              <li key={r.id} className="py-2.5">
                <p className="text-zinc-800 dark:text-zinc-200">
                  {name(state.concepts, r.fromConceptId)} <span className="text-zinc-400">{RELATIONSHIP_LABEL[r.type]}</span> {name(state.concepts, r.toConceptId)}
                </p>
                {r.reason && <p className="mt-0.5 text-xs text-zinc-400">{r.reason}</p>}
                <div className="mt-1.5 flex gap-2 text-[11px]">
                  <button type="button" onClick={() => approveConceptRelationship(r.id)} className="rounded-full border border-black/[.12] px-2.5 py-1 hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]">Approve</button>
                  <button type="button" onClick={() => removeConceptRelationship(r.id)} className="rounded-full px-2.5 py-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">Reject</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Propose a new relationship */}
      {others.length > 0 && (
        <div className="rounded-xl border border-black/[.06] p-3 dark:border-white/[.08]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Relate to another concept</p>
          <div className="flex flex-col gap-2">
            <select value={type} onChange={(e) => setType(e.target.value as ConceptRelationshipType)} className="rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm outline-none dark:border-white/[.15]">
              {RELATIONSHIP_TYPES.map((t) => <option key={t} value={t}>{RELATIONSHIP_LABEL[t]}</option>)}
            </select>
            <select value={toId} onChange={(e) => setToId(e.target.value)} className="rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm outline-none dark:border-white/[.15]">
              <option value="">— choose a concept —</option>
              {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why does this hold? (required)" className="rounded-lg border border-black/[.12] bg-transparent px-3 py-1.5 text-sm outline-none dark:border-white/[.15]" />
            <button type="button" onClick={propose} disabled={!toId || !reason.trim()} className="self-start rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900">Add relationship</button>
          </div>
        </div>
      )}
    </div>
  );
}
