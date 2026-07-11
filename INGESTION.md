# LifeOS Ingestion Architecture (LIFEOS-006)

> How knowledge from any source becomes one internal object. This is the
> permanent ingestion architecture — the specific adapters are replaceable;
> the shape is not.

## The one internal object

Every source, whatever its origin, becomes a **`KnowledgeSource`**
(`types/mvp.ts`) with an **immutable `originalText`** plus provenance
(`type`, `input`, `title`, `author`, `origin`, `addedAt`). Nothing
downstream — pipeline, Reader, Library, Inbox, persistence — cares how the
text was obtained.

## Two seams

```
raw material ──[ IngestionAdapter ]──> IngestionResult ──> KnowledgeSource
                                                                  │
                                                     [ processing pipeline ]
                                                                  │
                        summary · quotes · concepts · candidate beliefs
```

### 1. Ingestion adapters (`lib/ingestion/`)
An `IngestionAdapter` turns one kind of raw material into an
`IngestionResult` (`{ type, input, title, author, origin, text, needsText,
note }`). That's its only job.

- **`textAdapter`** — plain text; fully automated.
- **`urlAdapter`** — web article; automated. Delegates to `/api/extract`
  (mode `url`), which fetches the page and reduces HTML → text with **no
  dependency**. Degrades to `needsText` on fetch failure / JS-rendered
  pages / thin bodies.
- **`pdfAdapter`** — PDF; **real, page-aware extraction (LIFEOS-008).**
  `lib/ingestion/pdfExtract.ts` runs **pdf.js in the browser** (dynamic
  import; worker served from `public/pdf.worker.min.js`, copied from
  node_modules at build time by `scripts/copy-pdf-worker.mjs`). Extracts text
  **per page**, keeps a `pageMap` (page → char range in the normalized text),
  and records `pdfMeta` (filename/size/pageCount/mime/uploadedAt/
  extractedPages). **Only the extracted text is stored — never the PDF
  binary** (no upload, no Vercel body limits, no Supabase Storage bucket, no
  file-exposure risk). Chunks inherit `pageStart`/`pageEnd`; quotes show
  their page. Scanned / malformed / password-protected PDFs are detected and
  reported via `extractionStatus` (`text_extracted` / `partial_text` /
  `scanned_ocr_required` / `extraction_failed`), falling back to manual paste
  or PDF re-upload — never faked. Limits: 25 MB, 1500 pages, ~600k extracted
  chars (excess → `partial_text`). OCR is not implemented (status only).

`needsText: true` is the honest fallback: the source exists with provenance,
and the reader collects the body (a one-time set — `originalText` stays
immutable thereafter).

**Adding a source kind** = implement `IngestionAdapter`, add it to
`runAdapter()` in `lib/ingestion/index.ts`, and register it in
`lib/ingestion/registry.ts`. Planned adapters (epub, kindle, markdown, html,
research paper, image/OCR, audio/YouTube/podcast transcript, conversation,
email, journal) all follow this exact contract — see `PLANNED_ADAPTERS`.

### 2. Extraction route (`app/api/extract/route.ts`)
A **non-AI** utility route (does not call a model — the single AI route
stays `/api/ai`). Handles `mode: "url"` (real, dependency-free extraction
with an SSRF guard, timeout, and size caps) and `mode: "pdf"` (the seam,
currently returns `needsText`). This is where a better HTML extractor or a
real PDF parser plugs in.

## The pipeline (`lib/pipeline.ts`) — long-source map/reduce (LIFEOS-007)

A source is analyzed from its **full content** via chunk-level map/reduce,
cost-aware by default:

```
normalize → chunk (stable, with char offsets) → select chunks (by mode) →
MAP each selected chunk (1 AI call each) → REDUCE:
   · concepts / quotes / beliefs  = deterministic dedup   (0 AI calls)
   · summary                      = 1 AI call (skipped when only 1 chunk)
```

**Chunks are operational, not decorative.** `buildChunks` produces stable
ids (`<sourceId>:c<index>`), char `start`/`end` offsets into the normalized
text, and is deterministic — reruns don't move boundaries. Quote offsets are
lifted from chunk-local to source-wide so every artifact traces back to the
source.

**Processing modes:**
- **Quick** (default on ingest) — a representative, evenly-spaced subset
  (`QUICK_CHUNKS = 3`, sampling beyond the opening prefix). Labeled
  *sampled*; state → `partial`.
- **Full** — all chunks up to `FULL_CHUNK_LIMIT = 40`. Labeled *full*;
  state → `ready` (or `partial` if the cap is hit).
- **On-demand** — re-run a single stage (`runStage`): concepts/quotes/
  beliefs re-reduce from stored chunk results (0 AI calls); summary re-runs
  the reduce (1 AI call).

**Cost control:** concurrency 3, already-mapped chunks are skipped
(idempotent/resumable), an approximate call count is shown before running
(Quick ≈ min(3,N)+1, Full ≈ min(40,N)+1), and analysis is cancellable
(cooperative, between chunks).

**Per-stage status** (`summary`/`quotes`/`concepts`/`beliefs`): a failure in
one stage never erases another's results (deterministic artifacts are
persisted before the summary reduce runs); each stage is retryable
independently.

**Provenance guarantees:** every source stores `chunkResults` (per-chunk map
output) + `analysis` (`mode`, `coverage`, `chunksAnalyzed`, `totalChunks`,
`source: ai|mock`, `unmatchedQuotes`, `updatedAt`). Quotes are verified to be
**exact substrings** of the source; AI-returned quotes that don't match are
dropped and counted. The reducer only dedups chunk output — it never invents
support that wasn't in a chunk.

The immutable `originalText` is never mutated (a normalized working copy is
used). Candidate beliefs never auto-enter the Inbox or Constitution — the
human sends them.

## Deliberate non-goals (this milestone)
No embeddings, vector DB, search engine, graph, megathreads, background
agents, comparative intelligence, OCR/transcription, or EPUB. These are
future milestones.
