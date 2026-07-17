"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { DialogueSession } from "@/types/mvp";
import { useStore } from "@/lib/mvpStore";
import { buildDialogueContext, type DialogueContext } from "@/lib/dialogue/context";
import type { GraphNode } from "@/lib/graph";

const HREF: Partial<Record<string, (id: string) => string>> = {
  concept: (id) => `/world/concept/${id}`,
  research_project: (id) => `/research/${id}`,
  knowledge_project: (id) => `/author/${id}`,
  decision: (id) => `/decisions/${id}`,
  formation: (id) => `/formation/${id}`,
};

function Group({ title, hint, nodes }: { title: string; hint?: string; nodes: GraphNode[] }) {
  if (nodes.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}{hint ? <span className="ml-1 font-normal normal-case text-zinc-400">{hint}</span> : null}</h3>
      <ul className="flex flex-wrap gap-1.5">
        {nodes.map((n) => {
          const href = HREF[n.kind]?.(n.id);
          const inner = <span className="inline-flex items-center gap-1 rounded bg-black/[.05] px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-white/[.08] dark:text-zinc-300"><span className="font-mono text-[10px] text-zinc-400">{n.kind.replace(/_/g, " ")}</span>{n.label}</span>;
          return <li key={n.id}>{href ? <Link href={href}>{inner}</Link> : inner}</li>;
        })}
      </ul>
    </div>
  );
}

/**
 * Graph-surfaced context for a dialogue (LIFEOS-022, Phase 6). Reuses the
 * unified knowledge graph — every item is an EXPLICIT neighbour of a seed
 * record. Nothing is inferred; these are invitations to cite, not claims.
 */
export default function DialogueGraphContext({ session }: { session: DialogueSession }) {
  const state = useStore();
  const ctx: DialogueContext = useMemo(() => buildDialogueContext(state, session), [state, session]);
  const empty = Object.values(ctx).every((v) => v.length === 0);

  if (empty) {
    return <p className="rounded-2xl border border-dashed border-black/[.10] p-5 text-sm text-zinc-500 dark:border-white/[.12]">No graph context yet. Anchor this dialogue to a belief, concept, or thread — or cite records in your turns — and related evidence will surface here.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Group title="Related concepts" nodes={ctx.relatedConcepts} />
      <Group title="Supporting beliefs" nodes={ctx.supportingBeliefs} />
      <Group title="Contradicting beliefs" hint="(worth facing)" nodes={ctx.contradictingBeliefs} />
      <Group title="Related research" nodes={ctx.relatedResearch} />
      <Group title="Related authoring" nodes={ctx.relatedAuthoring} />
      <Group title="Decision history" nodes={ctx.decisionHistory} />
      <Group title="Formation history" nodes={ctx.formationHistory} />
    </div>
  );
}
