"use client";

import { useMemo, useState } from "react";
import type { DraftSection, DraftTransform, KnowledgeProject } from "@/types/mvp";
import {
  getStoreSnapshot,
  removeProjectSection,
  removeSectionParagraph,
  setSectionDraft,
  setSectionHeading,
  useStore,
} from "@/lib/mvpStore";
import { runSectionDraft, TRANSFORMS } from "@/lib/authoring/draft";
import { citationIndex } from "@/lib/authoring/citations";
import { crossReferences } from "@/lib/authoring/crossref";

const TRANSFORM_LABEL: Record<DraftTransform, string> = {
  rewrite: "Rewrite", expand: "Expand", compress: "Compress", clarify: "Clarify",
  academic: "Academic", popular: "Popular", technical: "Technical", conversational: "Conversational",
};

export default function AuthoringSection({ project, section }: { project: KnowledgeProject; section: DraftSection }) {
  const state = useStore();
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showXref, setShowXref] = useState(false);

  const index = useMemo(() => citationIndex(state, project), [state, project]);
  const xrefs = useMemo(() => crossReferences(state, project, section), [state, project, section]);
  const unsupported = section.paragraphs.filter((p) => p.citations.length === 0).length;

  async function draft(transform?: DraftTransform) {
    if (running) return;
    setRunning(transform ?? "draft");
    setError(null);
    try {
      const fresh = getStoreSnapshot().knowledgeProjects.find((p) => p.id === project.id);
      const sec = fresh?.sections.find((s) => s.id === section.id);
      if (!fresh || !sec) return;
      const r = await runSectionDraft(getStoreSnapshot(), fresh, sec, transform);
      setSectionDraft(project.id, section.id, r.paragraphs, r.source, r.fingerprint, transform ? `transform: ${transform}` : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft failed.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="rounded-2xl border border-black/[.06] p-5 dark:border-white/[.08]">
      <div className="flex items-start justify-between gap-3">
        <input
          defaultValue={section.heading}
          onBlur={(e) => e.target.value.trim() && e.target.value !== section.heading && setSectionHeading(project.id, section.id, e.target.value)}
          className="flex-1 bg-transparent text-base font-semibold outline-none"
        />
        <button type="button" onClick={() => removeProjectSection(project.id, section.id)} className="shrink-0 text-[11px] text-zinc-400 hover:text-red-500">remove</button>
      </div>
      {section.purpose && <p className="mt-0.5 text-xs text-zinc-400">{section.purpose}</p>}

      {/* Paragraphs */}
      {section.paragraphs.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-3">
          {section.paragraphs.map((p) => (
            <li key={p.id} className={`rounded-lg border p-3 ${p.citations.length === 0 ? "border-amber-300/60 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/[.06]" : "border-black/[.06] dark:border-white/[.08]"}`}>
              <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{p.text}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {p.citations.length === 0 ? (
                  <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Unsupported — no citation</span>
                ) : (
                  p.citations.map((cid) => {
                    const c = index.get(cid);
                    return (
                      <span key={cid} className="inline-flex items-center gap-1 rounded bg-black/[.05] px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-white/[.08]">
                        <span className="font-mono text-[10px] text-zinc-400">{c?.kind ?? "?"}</span>
                        <span className="max-w-[10rem] truncate">{c?.label ?? cid}</span>
                      </span>
                    );
                  })
                )}
                <button type="button" onClick={() => removeSectionParagraph(project.id, section.id, p.id)} className="ml-auto text-[11px] text-zinc-400 hover:text-red-500">remove</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">Not drafted yet. Draft this section from your assembled evidence.</p>
      )}

      {unsupported > 0 && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{unsupported} unsupported paragraph{unsupported === 1 ? "" : "s"} — cite or remove.</p>}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* Draft + transforms */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => draft()} disabled={!!running} className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900">
          {running === "draft" ? "Drafting…" : section.paragraphs.length ? "Re-draft" : "Draft section"}
        </button>
        {section.paragraphs.length > 0 && TRANSFORMS.map((t) => (
          <button key={t} type="button" onClick={() => draft(t)} disabled={!!running} className="rounded-full border border-black/[.12] px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 disabled:opacity-40 dark:border-white/[.15] dark:hover:text-zinc-100">
            {running === t ? "…" : TRANSFORM_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Cross-references + history */}
      <div className="mt-3 flex gap-3 text-xs">
        {xrefs.length > 0 && (
          <button type="button" onClick={() => setShowXref((v) => !v)} className="text-zinc-400 underline-offset-4 hover:underline">
            {showXref ? "Hide" : "Show"} {xrefs.length} cross-reference{xrefs.length === 1 ? "" : "s"}
          </button>
        )}
        {section.versions.length > 0 && (
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="text-zinc-400 underline-offset-4 hover:underline">
            {showHistory ? "Hide" : "Show"} {section.versions.length} earlier version{section.versions.length === 1 ? "" : "s"}
          </button>
        )}
      </div>

      {showXref && xrefs.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5 rounded-lg border border-black/[.06] p-3 text-xs dark:border-white/[.08]">
          {xrefs.map((x) => (
            <li key={x.id}>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{x.kind.replace(/_/g, " ")}:</span> {x.title}
              <span className="block text-zinc-400">{x.detail} (suggestion only — never inserted for you)</span>
            </li>
          ))}
        </ul>
      )}

      {showHistory && section.versions.length > 0 && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-black/[.06] p-3 text-xs dark:border-white/[.08]">
          {[...section.versions].reverse().map((v, i) => (
            <div key={i}>
              <p className="text-zinc-400">{new Date(v.at).toLocaleString()} · {v.source}{v.note ? ` · ${v.note}` : ""}</p>
              <p className="mt-0.5 text-zinc-600 dark:text-zinc-300">{v.paragraphs.map((p) => p.text).join(" ").slice(0, 200)}…</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
