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

/** Where a piece of data ultimately came from. */
export type Provenance = "human" | "import" | "ai-proposed";

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

/** Discriminator used by Relationship and Revision to point at any ontology object. */
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
  | "Relationship";

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

// ---------- Source & subtypes ----------

export interface Source extends BaseEntity {
  type: "book" | "article"; // extend as new Source subtypes are added
  title: string;
  capturedAt: ISODateTime;
  provenance: Extract<Provenance, "human" | "import">;
  authorIds?: ID[];
  publishedAt?: ISODateTime;
  url?: string;
  identifier?: string;
  description?: string;
  tags?: string[];
}

export interface Book extends Source {
  type: "book";
  authorIds: ID[];
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

export interface Claim extends BaseEntity, Versioned {
  statement: string;
  provenance: Provenance;
  status: ClaimStatus;
  sourceId?: ID;
  quoteId?: ID;
  confidence?: number;
  tags?: string[];
}

// ---------- Concept (versioned) ----------

export interface Concept extends BaseEntity, Versioned {
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

export interface Argument extends BaseEntity, Versioned {
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

export interface ConstitutionEntry extends BaseEntity, Versioned {
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

// ---------- Project ----------

export interface Project extends BaseEntity {
  title: string;
  status: ProjectStatus;
  description?: string;
  tags?: string[];
  targetDate?: ISODateTime;
}

// ---------- Relationship (typed graph edge) ----------

export interface Relationship extends BaseEntity {
  fromType: OntologyType;
  fromId: ID;
  toType: OntologyType;
  toId: ID;
  relationType: RelationType;
  status: RelationshipStatus;
  note?: string;
  strength?: number;
}
