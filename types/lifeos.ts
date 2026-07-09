/**
 * LifeOS domain model — provisional, first-pass types.
 *
 * Mirrors the ontology defined in ONTOLOGY.md. This file intentionally
 * contains no database logic and no API implementation — it defines the
 * shape of the domain independent of how it is eventually persisted, so
 * it can survive a future Supabase implementation (see ARCHITECTURE.md)
 * without every consumer changing.
 *
 * "Versioned" objects (see ONTOLOGY.md's mutability rules) carry a
 * `version` number; material changes to them are expected to produce a
 * `Revision` record rather than an in-place overwrite.
 */

// ---------- Shared primitives ----------

export type ID = string;
export type ISODateTime = string;

/** Categorical origin of a piece of data — distinct from who or what acted on it (see ProvenanceMeta below). */
export type Provenance = "human" | "import" | "ai-proposed";

/** Who most recently acted on a record: the user, or an AI agent acting under the user's direction. */
export type Actor = "user" | "ai";

export type ClaimStatus = "proposed" | "accepted" | "contested" | "retracted";
export type ArgumentStatus = "draft" | "active" | "superseded";
export type QuestionStatus = "open" | "in-progress" | "resolved" | "abandoned";
export type MegathreadStatus = "active" | "dormant" | "archived";
export type ConstitutionEntryStatus = "draft" | "active" | "retired";
export type PracticeStatus = "active" | "paused" | "dropped";
export type ProjectStatus = "active" | "paused" | "completed" | "archived";
export type RelationshipStatus = "active" | "retracted";

export type RelationType =
  | "supports"
  | "contradicts"
  | "cites"
  | "responds-to"
  | "part-of"
  | "derived-from"
  | "related-to"
  | "authored-by"
  | "member-of";

/**
 * All kinds of originating material LifeOS can ingest. `book` and `article`
 * have narrowed subtypes (`Book`, `Article`) with type-specific fields; the
 * rest are represented directly as `Source` today and should NOT be assumed
 * to not exist just because they lack a narrowed subtype yet — code working
 * with `Source` must handle the full union, not just books/articles.
 */
export type SourceType =
  | "book"
  | "article"
  | "pdf"
  | "webpage"
  | "video"
  | "podcast"
  | "conversation"
  | "journal"
  | "image"
  | "other";

/** Discriminator used by Relationship, Revision, and UserJudgment to point at any ontology object. */
export type OntologyType =
  | "Source"
  | "Book"
  | "Article"
  | "Note"
  | "Quote"
  | "Claim"
  | "Concept"
  | "Person"
  | "Tradition"
  | "Argument"
  | "Question"
  | "Megathread"
  | "ConstitutionEntry"
  | "Practice"
  | "Reflection"
  | "Revision"
  | "Project"
  | "Relationship"
  | "UserJudgment";

// ---------- Shared bases ----------

interface BaseEntity {
  id: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Mixin for objects whose material changes must produce a Revision (see ONTOLOGY.md). */
interface Versioned {
  version: number;
}

/**
 * Stronger provenance metadata for objects that may be created or touched
 * by AI and need an evidence trail — layered on top of (not a replacement
 * for) any object-specific `provenance: Provenance` field, which answers
 * "how did this come to exist" (human/import/ai-proposed) while this
 * answers "who last touched it, with what, and what backs it up."
 */
interface ProvenanceMeta {
  createdBy: Actor;
  updatedBy: Actor;
  /** Which AI model produced/touched this, when createdBy or updatedBy is "ai" (e.g. "claude-sonnet-5"). */
  aiModel?: string;
  /** Where in the originating material this came from (page, timestamp, URL fragment, etc.), when applicable. */
  sourceLocation?: string;
  /** 0–1, meaningful mainly for ai-proposed content. */
  confidence?: number;
  /** Ids of Quote/Claim/Source (or other) records that support this assertion. */
  evidenceIds?: ID[];
}

// ---------- Source & subtypes ----------

/**
 * How confidently authorship is known, independent of whether `authorIds`
 * is populated — e.g. a `Book` can have `authorAttribution: "traditional"`
 * with an `authorIds` entry for the traditionally-named author, or
 * `"anonymous"` with no `authorIds` at all. See ONTOLOGY.md's authorship
 * representation rule (structural fields vs. Relationship records).
 */
export type AuthorAttribution = "confirmed" | "traditional" | "disputed" | "anonymous";

export interface Source extends BaseEntity {
  type: SourceType;
  title: string;
  capturedAt: ISODateTime;
  provenance: Extract<Provenance, "human" | "import">;
  authorIds?: ID[];
  /** Defined on Source (not just Book) since Article and other source types can be equally anonymous/disputed. */
  authorAttribution?: AuthorAttribution;
  publishedAt?: ISODateTime;
  url?: string;
  identifier?: string;
  description?: string;
  tags?: string[];
}

export interface Book extends Source {
  type: "book";
  isbn?: string;
  edition?: string;
  publisher?: string;
  publishedYear?: number;
  totalPages?: number;
}

export interface Article extends Source {
  type: "article";
  venue?: string;
}

// ---------- Note ----------

export interface Note extends BaseEntity {
  body: string;
  /** AI never authors a Note on the user's behalf — see AI_AGENT_RULES.md. */
  authorship: "user";
  title?: string;
  tags?: string[];
  sourceIds?: ID[];
  conceptIds?: ID[];
  claimIds?: ID[];
  questionIds?: ID[];
}

// ---------- Quote (immutable text) ----------

export interface Quote extends BaseEntity {
  sourceId: ID;
  /** Verbatim excerpt. Immutable once set — corrections go through a Revision, never an overwrite. */
  text: string;
  location?: string;
  context?: string;
  tags?: string[];
}

// ---------- Claim (versioned) ----------

export interface Claim extends BaseEntity, Versioned, ProvenanceMeta {
  statement: string;
  provenance: Provenance;
  status: ClaimStatus;
  sourceId?: ID;
  quoteId?: ID;
  tags?: string[];
}

// ---------- Concept (versioned) ----------

export interface Concept extends BaseEntity, Versioned, ProvenanceMeta {
  name: string;
  description: string;
  aliases?: string[];
  tags?: string[];
  relatedTraditionIds?: ID[];
}

// ---------- Person ----------

export interface Person extends BaseEntity {
  name: string;
  bio?: string;
  birthDate?: ISODateTime;
  deathDate?: ISODateTime;
  traditionIds?: ID[];
  aliases?: string[];
  externalLinks?: string[];
}

// ---------- Tradition ----------

export interface Tradition extends BaseEntity {
  name: string;
  description: string;
  parentTraditionId?: ID;
  tags?: string[];
}

// ---------- Argument (versioned) ----------

/** A premise is either a reference to an existing Claim or an inline statement not yet promoted to one. */
export interface ArgumentPremise {
  claimId?: ID;
  statement?: string;
}

export interface Argument extends BaseEntity, Versioned, ProvenanceMeta {
  conclusionClaimId: ID;
  premises: ArgumentPremise[];
  status: ArgumentStatus;
  counterArgumentIds?: ID[];
  sourceId?: ID;
  tags?: string[];
}

// ---------- Question ----------

export interface Question extends BaseEntity {
  text: string;
  status: QuestionStatus;
  relatedConceptIds?: ID[];
  resolutionClaimId?: ID;
  tags?: string[];
}

// ---------- Megathread ----------

export interface Megathread extends BaseEntity {
  title: string;
  status: MegathreadStatus;
  description?: string;
  relatedConceptIds?: ID[];
  relatedQuestionIds?: ID[];
}

// ---------- ConstitutionEntry (versioned, highest-stakes object) ----------

export interface ConstitutionEntry extends BaseEntity, Versioned, ProvenanceMeta {
  statement: string;
  status: ConstitutionEntryStatus;
  /** Claim / Argument / Reflection ids this entry was synthesized from. */
  derivedFrom: ID[];
  relatedPracticeIds?: ID[];
  tags?: string[];
  /** If this entry replaces a prior one, it must reference it rather than the prior entry being deleted. */
  supersedesEntryId?: ID;
}

// ---------- Practice ----------

export interface Practice extends BaseEntity {
  title: string;
  status: PracticeStatus;
  constitutionEntryId: ID;
  cadence?: string;
  description?: string;
  tags?: string[];
}

// ---------- Reflection (immutable body) ----------

export interface Reflection extends BaseEntity {
  /** Immutable in spirit, like a journal entry — corrections are new Reflections/Revisions, not overwrites. */
  body: string;
  mood?: string;
  tags?: string[];
  relatedConstitutionEntryIds?: ID[];
  relatedPracticeIds?: ID[];
  relatedMegathreadId?: ID;
}

// ---------- Revision (immutable, append-only history record) ----------

export interface Revision {
  id: ID;
  targetType: OntologyType;
  targetId: ID;
  previousValue: unknown;
  newValue: unknown;
  changedAt: ISODateTime;
  changeReason: {
    actor: "human" | "ai-proposed";
    note?: string;
  };
  /** Reserved for a future multi-user scenario; today always the single user or AI acting under their direction. */
  authorId?: ID;
}

// ---------- UserJudgment (human verdict on AI-proposed content) ----------

export type JudgmentDecision = "accepted" | "rejected" | "questioned" | "revised";

/**
 * Records the human's verdict on an AI-proposed Claim, summary, Concept
 * link, or other interpretation — the enforcement point for "AI assists
 * judgment but does not replace judgment" (PRINCIPLES.md §2). AI-proposed
 * content should be treated as provisional until a UserJudgment exists
 * for it (or its status field otherwise reflects user confirmation).
 */
export interface UserJudgment {
  id: ID;
  targetType: OntologyType;
  targetId: ID;
  decision: JudgmentDecision;
  note?: string;
  /** Set when decision is "revised" — points at the Revision this judgment produced. */
  revisionId?: ID;
  judgedAt: ISODateTime;
}

// ---------- Project ----------

export interface Project extends BaseEntity {
  title: string;
  status: ProjectStatus;
  description?: string;
  tags?: string[];
  targetDate?: ISODateTime;
}

// ---------- Relationship (typed graph edge) ----------

/**
 * A typed edge between any two first-class ontology objects. `fromType`
 * and `toType` are independently drawn from `OntologyType`, so a
 * Relationship can connect any object to any other — e.g. Claim↔Person,
 * Note↔Project, Concept↔Tradition — not just objects of the same kind.
 */
export interface Relationship extends BaseEntity, ProvenanceMeta {
  fromType: OntologyType;
  fromId: ID;
  toType: OntologyType;
  toId: ID;
  relationType: RelationType;
  status: RelationshipStatus;
  note?: string;
  strength?: number;
}
