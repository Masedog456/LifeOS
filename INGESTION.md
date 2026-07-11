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
- **`pdfAdapter`** — PDF; **clean seam, not yet automated.** The single
  extraction point is `extractPdfText(file)` (returns `null` today). A
  future client pdf.js or server parser drops in there — nothing else
  changes. Until then the source is created with provenance and its text is
  pasted in the reader.

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

## The pipeline (`lib/pipeline.ts`)

An **ordered array of replaceable stages** (`PIPELINE_STAGES`). Swapping,
reordering, or inserting a stage touches only that array.

| Stage | Where it runs | AI |
|-------|---------------|----|
| Capture | ingestion (`ingest`) | — |
| Extraction | adapter | — |
| Normalization | `normalizeStage` | — |
| Chunking | `chunkStage` | — |
| Metadata | `metadataStage` (captured at ingestion; seam for derived) | — |
| Summary | `summaryStage` | ✓ |
| Quotes | `quotesStage` | ✓ |
| Concepts | `conceptsStage` | ✓ |
| Claims (belief candidates) | `beliefCandidatesStage` | ✓ |
| Questions | `questionsStage` — **inactive seam** | — |
| Relationships | `relationshipsStage` — **inactive seam** | — |
| Library | the source is in the library throughout | — |
| Inbox | user sends candidates (never automatic) | — |

The immutable `originalText` is never mutated; a normalized working copy
flows through the pipeline context. Every derived artifact (summary, quotes,
concepts, candidate beliefs) is stored **on the source**, so it always
references its origin. Candidate beliefs never auto-enter the Inbox or
Constitution — the human sends them.

## Deliberate non-goals (this milestone)
No embeddings, vector DB, search engine, graph, megathreads, background
agents, or OCR/transcription. Questions/Relationships stages exist as
inactive seams only. These are future milestones.
