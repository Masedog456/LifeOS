"use client";

import type { ResearchProject } from "@/types/mvp";
import { useStore } from "@/lib/mvpStore";
import { EXPORT_FORMATS, type ExportFormat } from "@/lib/authoring/export";
import { exportResearch } from "@/lib/research/export";

const LABEL: Record<ExportFormat, string> = { markdown: "Markdown", html: "HTML", docx: "DOCX", pdf: "PDF" };

/** Deterministic research export + download (reuses the authoring export writers). */
export default function ResearchExportBar({ project }: { project: ResearchProject }) {
  const state = useStore();

  function download(format: ExportFormat) {
    const { filename, mime, data } = exportResearch(state, project, format);
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

  return (
    <div className="flex flex-wrap gap-1.5">
      {EXPORT_FORMATS.map((f) => (
        <button key={f} type="button" onClick={() => download(f)} data-export={f} className="rounded-full border border-black/[.12] px-3 py-1.5 text-xs hover:bg-black/[.04] dark:border-white/[.15] dark:hover:bg-white/[.06]">
          {LABEL[f]}
        </button>
      ))}
    </div>
  );
}
