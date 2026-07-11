"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { SourceType } from "@/types/mvp";
import { addSource } from "@/lib/mvpStore";
import { processSource } from "@/lib/pipeline";
import { MANUAL_TEXT_TYPES, SOURCE_TYPE_LABELS } from "@/lib/labels";

type Mode = "text" | "pdf" | "url";

const MODES: { id: Mode; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "pdf", label: "PDF" },
  { id: "url", label: "URL" },
];

export default function AddSource() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("text");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [type, setType] = useState<SourceType>("other");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const submitting = useRef(false);

  function reset() {
    setTitle("");
    setAuthor("");
    setBody("");
    setUrl("");
    setType("other");
  }

  function addText() {
    if (!body.trim() || submitting.current) return;
    submitting.current = true;
    const id = addSource({
      type,
      input: "text",
      title: title.trim() || body.trim().slice(0, 48),
      author,
      originalText: body.trim(),
    });
    void processSource(id, body.trim());
    submitting.current = false;
    reset();
    router.push(`/library/${id}`);
  }

  function addUrl() {
    if (!url.trim() || submitting.current) return;
    submitting.current = true;
    const id = addSource({
      type: "webpage",
      input: "url",
      title: title.trim() || url.trim(),
      origin: url.trim(),
      originalText: "",
      processingState: "needs_text",
    });
    submitting.current = false;
    reset();
    router.push(`/library/${id}`);
  }

  function onPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || submitting.current) return;
    submitting.current = true;
    const name = file.name.replace(/\.pdf$/i, "");
    // Automated PDF text extraction is a later ingestion adapter; for now
    // the source is created with provenance and awaits its text in the
    // reader (see PROJECT_MEMORY / LIFEOS-003 notes).
    const id = addSource({
      type: "pdf",
      input: "pdf",
      title: title.trim() || name,
      author,
      origin: file.name,
      originalText: "",
      processingState: "needs_text",
    });
    submitting.current = false;
    reset();
    e.target.value = "";
    router.push(`/library/${id}`);
  }

  const input =
    "w-full rounded-lg border border-black/[.10] bg-transparent px-3 py-2 text-sm outline-none focus:border-black/[.25] dark:border-white/[.12] dark:focus:border-white/[.30]";

  return (
    <div className="rounded-2xl border border-black/[.06] p-5 dark:border-white/[.08]">
      <div className="mb-4 flex gap-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              mode === m.id
                ? "bg-black/[.06] font-medium dark:bg-white/[.10]"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className={input}
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {mode !== "url" && (
            <input
              className={input}
              placeholder="Author (optional)"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          )}
        </div>

        {mode === "text" && (
          <>
            <select
              className={input}
              value={type}
              onChange={(e) => setType(e.target.value as SourceType)}
            >
              {MANUAL_TEXT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SOURCE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <textarea
              className={`${input} resize-none`}
              rows={5}
              placeholder="Paste the text to add to your library…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <button
              type="button"
              onClick={addText}
              disabled={!body.trim()}
              className="self-start rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Add & process
            </button>
          </>
        )}

        {mode === "url" && (
          <>
            <input
              className={input}
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-xs text-zinc-400">
              The article body is pasted in the reader for now — automatic
              fetching is a later ingestion adapter.
            </p>
            <button
              type="button"
              onClick={addUrl}
              disabled={!url.trim()}
              className="self-start rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Add source
            </button>
          </>
        )}

        {mode === "pdf" && (
          <>
            <input className={input} type="file" accept="application/pdf" onChange={onPdf} />
            <p className="text-xs text-zinc-400">
              The PDF is registered with its filename as provenance; its text
              is provided in the reader for now — automatic extraction is a
              later ingestion adapter.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
