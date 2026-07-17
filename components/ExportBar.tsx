"use client";

import type { KnowledgeProject } from "@/types/mvp";
import { useStore } from "@/lib/mvpStore";
import { EXPORT_FORMATS, exportProject, type ExportFormat } from "@/lib/authoring/export";

const LABEL: Record<ExportFormat, string> = { markdown: "Markdown", html: "HTML", docx: "DOCX", pdf: "PDF" };

/** Deterministic client-side export + download. Citations preserved in every format. */
export default function ExportBar({ project }: { project: KnowledgeProject }) {
  const state = useStore();

  function download(format: ExportFormat) {
    const { filename, mime, data } = exportProject(state, project, format);
    const blob = data instanceof Uint8Array
      ? new Blob([data as BlobPart], { type: mime })
      : new Blob([data], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const empty = project.sections.every((s) => s.paragraphs.length === 0);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {EXPORT_FORMATS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => download(f)}
            disabled={empty}
            data-export={f}
            className="rounded-full border border-black/[.12] px-3 py-1.5 text-xs hover:bg-black/[.04] disabled:opacity-30 dark:border-white/[.15] dark:hover:bg-white/[.06]"
          >
            {LABEL[f]}
          </button>
        ))}
      </div>
      {empty && <p className="mt-1 text-xs text-zinc-400">Draft at least one section to export.</p>}
    </div>
  );
}
