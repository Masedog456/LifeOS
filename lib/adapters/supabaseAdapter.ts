/**
 * SupabasePersistenceAdapter — durable, per-user, RLS-protected backend.
 *
 * Maps the flat StoreState to/from the relational schema in
 * supabase/migrations/0001_initial_schema.sql. Append-only tables
 * (belief_revisions, user_judgments, saved_quotes) are written with
 * insert-or-ignore so history is never rewritten and existing rows are
 * never updated (which RLS forbids anyway).
 *
 * Note: user_id is set by the database default (auth.uid()), so rows are
 * never tagged client-side. This adapter requires an authenticated session
 * (the persistence facade signs the user in before using it).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Belief,
  Capture,
  Comparison,
  Inquiry,
  JudgmentEntry,
  KnowledgeChunk,
  KnowledgeSource,
  Proposal,
  RevisionEntry,
  SourceType,
  StoreState,
} from "@/types/mvp";
import type { PersistenceAdapter, PersistenceHealth, SyncState } from "@/lib/adapters/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export class SupabasePersistenceAdapter implements PersistenceAdapter {
  readonly mode = "supabase" as const;
  private client: SupabaseClient;
  private lastState: SyncState = "syncing";
  private lastError?: string;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  private async uid(): Promise<string | null> {
    const { data } = await this.client.auth.getUser();
    return data.user?.id ?? null;
  }

  async loadState(): Promise<Partial<StoreState> | null> {
    const [sources, captures, proposals, beliefs, revisions, judgments, quotes, feedback, comparisons, inquiries] =
      await Promise.all([
        this.client.from("sources").select("*"),
        this.client.from("captures").select("*"),
        this.client.from("proposals").select("*"),
        this.client.from("beliefs").select("*"),
        this.client.from("belief_revisions").select("*").order("seq", { ascending: true }),
        this.client.from("user_judgments").select("*").order("seq", { ascending: true }),
        this.client.from("saved_quotes").select("*").order("created_at", { ascending: true }),
        this.client.from("retrieval_feedback").select("*"),
        this.client.from("comparisons").select("*").order("created_at", { ascending: false }),
        this.client.from("inquiries").select("*").order("created_at", { ascending: false }),
      ]);

    const firstError =
      sources.error ||
      captures.error ||
      proposals.error ||
      beliefs.error ||
      revisions.error ||
      judgments.error ||
      quotes.error ||
      feedback.error ||
      comparisons.error ||
      inquiries.error;
    if (firstError) throw new Error(firstError.message);

    const quotesBySource = groupBy((quotes.data ?? []) as any[], "source_id");
    const revsByBelief = groupBy((revisions.data ?? []) as any[], "belief_id");
    const judsByBelief = groupBy((judgments.data ?? []) as any[], "belief_id");

    return {
      sources: (sources.data ?? []).map((r: any) =>
        rowToSource(r, (quotesBySource[r.id] ?? []).map((q) => q.text as string)),
      ),
      captures: (captures.data ?? []).map(rowToCapture),
      proposals: (proposals.data ?? []).map(rowToProposal),
      beliefs: (beliefs.data ?? []).map((r: any) =>
        rowToBelief(r, revsByBelief[r.id] ?? [], judsByBelief[r.id] ?? []),
      ),
      feedback: (feedback.data ?? []).map((r: any) => ({
        recordId: r.record_id,
        verdict: r.verdict,
        at: r.at,
        snoozeUntil: r.snooze_until ?? undefined,
      })),
      comparisons: (comparisons.data ?? []).map(rowToComparison),
      inquiries: (inquiries.data ?? []).map(rowToInquiry),
    };
  }

  async saveState(state: StoreState): Promise<void> {
    if (state.sources.length) {
      await this.throwing(this.client.from("sources").upsert(state.sources.map(sourceToRow)));
      // Extracted + user-saved quotes live in saved_quotes (append-only).
      const quoteRows = state.sources.flatMap((s) =>
        s.keyQuotes.map((text) => ({ source_id: s.id, text })),
      );
      if (quoteRows.length) await this.insertIgnore("saved_quotes", quoteRows, "source_id,text");
    }
    if (state.captures.length)
      await this.throwing(this.client.from("captures").upsert(state.captures.map(captureToRow)));
    if (state.proposals.length)
      await this.throwing(this.client.from("proposals").upsert(state.proposals.map(proposalToRow)));
    if (state.beliefs.length) {
      await this.throwing(this.client.from("beliefs").upsert(state.beliefs.map(beliefToRow)));
      const revRows = state.beliefs.flatMap((b) =>
        b.revisions.map((r, seq) => ({ belief_id: b.id, seq, text: r.text, reason: r.reason, at: r.at })),
      );
      const judRows = state.beliefs.flatMap((b) =>
        b.judgments.map((j, seq) => ({ belief_id: b.id, seq, decision: j.decision, note: j.note ?? null, at: j.at })),
      );
      if (revRows.length) await this.insertIgnore("belief_revisions", revRows, "belief_id,seq");
      if (judRows.length) await this.insertIgnore("user_judgments", judRows, "belief_id,seq");
    }
    if (state.feedback?.length) {
      const rows = state.feedback.map((f) => ({
        record_id: f.recordId,
        verdict: f.verdict,
        at: f.at,
        snooze_until: f.snoozeUntil ?? null,
      }));
      await this.insertIgnore("retrieval_feedback", rows, "user_id,record_id,at");
    }
    if (state.comparisons.length) {
      await this.throwing(this.client.from("comparisons").upsert(state.comparisons.map(comparisonToRow)));
    }
    if (state.inquiries.length) {
      await this.throwing(this.client.from("inquiries").upsert(state.inquiries.map(inquiryToRow)));
    }
    this.lastState = "synced";
    this.lastError = undefined;
  }

  async saveSource(source: KnowledgeSource): Promise<void> {
    await this.throwing(this.client.from("sources").upsert(sourceToRow(source)));
    if (source.keyQuotes.length) {
      await this.insertIgnore(
        "saved_quotes",
        source.keyQuotes.map((text) => ({ source_id: source.id, text })),
        "source_id,text",
      );
    }
  }

  async saveCapture(capture: Capture): Promise<void> {
    await this.throwing(this.client.from("captures").upsert(captureToRow(capture)));
  }

  async saveProposal(proposal: Proposal): Promise<void> {
    await this.throwing(this.client.from("proposals").upsert(proposalToRow(proposal)));
  }

  async saveBelief(belief: Belief): Promise<void> {
    await this.throwing(this.client.from("beliefs").upsert(beliefToRow(belief)));
    await this.insertIgnore(
      "belief_revisions",
      belief.revisions.map((r, seq) => ({ belief_id: belief.id, seq, text: r.text, reason: r.reason, at: r.at })),
      "belief_id,seq",
    );
    await this.insertIgnore(
      "user_judgments",
      belief.judgments.map((j, seq) => ({ belief_id: belief.id, seq, decision: j.decision, note: j.note ?? null, at: j.at })),
      "belief_id,seq",
    );
  }

  async saveRevision(beliefId: string, seq: number, revision: RevisionEntry): Promise<void> {
    await this.insertIgnore(
      "belief_revisions",
      [{ belief_id: beliefId, seq, text: revision.text, reason: revision.reason, at: revision.at }],
      "belief_id,seq",
    );
  }

  async saveJudgment(beliefId: string, seq: number, judgment: JudgmentEntry): Promise<void> {
    await this.insertIgnore(
      "user_judgments",
      [{ belief_id: beliefId, seq, decision: judgment.decision, note: judgment.note ?? null, at: judgment.at }],
      "belief_id,seq",
    );
  }

  async saveQuote(sourceId: string, quote: string): Promise<void> {
    await this.insertIgnore("saved_quotes", [{ source_id: sourceId, text: quote }], "source_id,text");
  }

  async deleteAll(): Promise<void> {
    const uid = await this.uid();
    if (!uid) return;
    // Delete beliefs first (cascades revisions/judgments), then the rest.
    // saved_quotes cascade from sources.
    await this.throwing(this.client.from("inquiries").delete().eq("user_id", uid));
    await this.throwing(this.client.from("comparisons").delete().eq("user_id", uid));
    await this.throwing(this.client.from("beliefs").delete().eq("user_id", uid));
    await this.throwing(this.client.from("proposals").delete().eq("user_id", uid));
    await this.throwing(this.client.from("captures").delete().eq("user_id", uid));
    await this.throwing(this.client.from("sources").delete().eq("user_id", uid));
  }

  health(): PersistenceHealth {
    return { mode: "supabase", state: this.lastState, error: this.lastError };
  }

  private async throwing(query: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
    const { error } = await query;
    if (error) {
      this.lastState = "failed";
      this.lastError = error.message;
      throw new Error(error.message);
    }
  }

  private async insertIgnore(table: string, rows: any[], onConflict: string): Promise<void> {
    if (!rows.length) return;
    await this.throwing(
      this.client.from(table).upsert(rows, { onConflict, ignoreDuplicates: true }),
    );
  }
}

// ---------- row mappers ----------

function sourceToRow(s: KnowledgeSource) {
  return {
    id: s.id,
    type: s.type,
    input: s.input,
    title: s.title,
    author: s.author ?? null,
    origin: s.origin ?? null,
    status: s.status,
    processing_state: s.processingState,
    processing_error: s.processingError ?? null,
    original_text: s.originalText,
    chunks: s.chunks,
    summary: s.summary ?? null,
    key_concepts: s.keyConcepts,
    candidate_beliefs: s.candidateBeliefs,
    derived_source: s.derivedSource ?? null,
    chunk_results: s.chunkResults ?? [],
    analysis: s.analysis ?? null,
    stages: s.stages ?? null,
    pdf_meta: s.pdfMeta ?? null,
    page_map: s.pageMap ?? null,
    extraction_status: s.extractionStatus ?? null,
    added_at: s.addedAt,
  };
}

function rowToSource(r: any, keyQuotes: string[]): KnowledgeSource {
  return {
    id: r.id,
    type: r.type as SourceType,
    input: r.input,
    title: r.title,
    author: r.author ?? undefined,
    origin: r.origin ?? undefined,
    addedAt: r.added_at,
    status: r.status,
    processingState: r.processing_state,
    processingError: r.processing_error ?? undefined,
    originalText: r.original_text ?? "",
    chunks: (r.chunks ?? []) as KnowledgeChunk[],
    summary: r.summary ?? undefined,
    keyQuotes,
    keyConcepts: (r.key_concepts ?? []) as string[],
    candidateBeliefs: (r.candidate_beliefs ?? []) as string[],
    derivedSource: r.derived_source ?? undefined,
    chunkResults: (r.chunk_results ?? []) as KnowledgeSource["chunkResults"],
    analysis: (r.analysis ?? undefined) as KnowledgeSource["analysis"],
    stages: (r.stages ?? undefined) as KnowledgeSource["stages"],
    pdfMeta: (r.pdf_meta ?? undefined) as KnowledgeSource["pdfMeta"],
    pageMap: (r.page_map ?? undefined) as KnowledgeSource["pageMap"],
    extractionStatus: (r.extraction_status ?? undefined) as KnowledgeSource["extractionStatus"],
  };
}

function captureToRow(c: Capture) {
  return { id: c.id, text: c.text, source_id: c.sourceId ?? null, created_at: c.createdAt };
}
function rowToCapture(r: any): Capture {
  return { id: r.id, text: r.text, sourceId: r.source_id ?? undefined, createdAt: r.created_at };
}

function proposalToRow(p: Proposal) {
  return {
    id: p.id,
    capture_id: p.captureId,
    claim: p.claim,
    theme: p.theme ?? null,
    span_start: p.spanStart ?? null,
    span_end: p.spanEnd ?? null,
    source: p.source,
    resolved: p.resolved,
    created_at: p.createdAt,
  };
}
function rowToProposal(r: any): Proposal {
  return {
    id: r.id,
    captureId: r.capture_id,
    claim: r.claim,
    theme: r.theme ?? undefined,
    spanStart: r.span_start ?? undefined,
    spanEnd: r.span_end ?? undefined,
    source: r.source,
    createdAt: r.created_at,
    resolved: r.resolved,
  };
}

function beliefToRow(b: Belief) {
  return {
    id: b.id,
    capture_id: b.captureId,
    proposal_id: b.proposalId,
    text: b.text,
    theme: b.theme ?? null,
    status: b.status,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
  };
}
function rowToBelief(r: any, revs: any[], juds: any[]): Belief {
  return {
    id: r.id,
    captureId: r.capture_id,
    proposalId: r.proposal_id,
    text: r.text,
    theme: r.theme ?? undefined,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    revisions: [...revs]
      .sort((a, b) => a.seq - b.seq)
      .map((x) => ({ text: x.text, at: x.at, reason: x.reason } as RevisionEntry)),
    judgments: [...juds]
      .sort((a, b) => a.seq - b.seq)
      .map((x) => ({ decision: x.decision, at: x.at, note: x.note ?? undefined } as JudgmentEntry)),
  };
}

function comparisonToRow(c: Comparison) {
  return {
    id: c.id,
    title: c.title,
    question: c.question,
    inputs: c.inputs,
    source_ids: c.sourceIds,
    belief_ids: c.beliefIds,
    evidence: c.evidence,
    result: c.result,
    ai_model: c.aiModel,
    source: c.source,
    coverage: c.coverage,
    partial: c.partial,
    verified: c.verified,
    judgments: c.judgments,
    created_at: c.createdAt,
  };
}

function rowToComparison(r: any): Comparison {
  return {
    id: r.id,
    title: r.title,
    question: r.question,
    inputs: (r.inputs ?? []) as Comparison["inputs"],
    sourceIds: (r.source_ids ?? []) as string[],
    beliefIds: (r.belief_ids ?? []) as string[],
    evidence: (r.evidence ?? []) as Comparison["evidence"],
    result: r.result as Comparison["result"],
    aiModel: r.ai_model ?? "mock",
    source: r.source ?? "mock",
    coverage: r.coverage ?? null,
    partial: Boolean(r.partial),
    verified: Boolean(r.verified),
    createdAt: r.created_at,
    judgments: (r.judgments ?? []) as Comparison["judgments"],
  };
}

function inquiryToRow(i: Inquiry) {
  return {
    id: i.id,
    question: i.question,
    inputs: i.inputs,
    source_ids: i.sourceIds,
    belief_ids: i.beliefIds,
    comparison_ids: i.comparisonIds,
    evidence: i.evidence,
    result: i.result,
    history: i.history,
    ai_model: i.aiModel,
    source: i.source,
    coverage: i.coverage,
    partial: i.partial,
    verified: i.verified,
    status: i.status,
    provisional_conclusion: i.provisionalConclusion ?? null,
    judgments: i.judgments,
    created_at: i.createdAt,
    updated_at: i.updatedAt,
  };
}

function rowToInquiry(r: any): Inquiry {
  return {
    id: r.id,
    question: r.question,
    inputs: (r.inputs ?? []) as Inquiry["inputs"],
    sourceIds: (r.source_ids ?? []) as string[],
    beliefIds: (r.belief_ids ?? []) as string[],
    comparisonIds: (r.comparison_ids ?? []) as string[],
    evidence: (r.evidence ?? []) as Inquiry["evidence"],
    result: r.result as Inquiry["result"],
    history: (r.history ?? []) as Inquiry["history"],
    aiModel: r.ai_model ?? "mock",
    source: r.source ?? "mock",
    coverage: r.coverage ?? null,
    partial: Boolean(r.partial),
    verified: Boolean(r.verified),
    status: (r.status ?? "open") as Inquiry["status"],
    provisionalConclusion: r.provisional_conclusion ?? undefined,
    judgments: (r.judgments ?? []) as Inquiry["judgments"],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function groupBy<T extends Record<string, any>>(rows: T[], key: string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const row of rows) {
    const k = row[key] as string;
    (out[k] ??= []).push(row);
  }
  return out;
}
