/**
 * Built-in local lexical embedder (LIFEOS-015, Phase 2).
 *
 * A deterministic, offline, zero-config "semantic" signal: a synonym-aware
 * bag-of-concepts. Words in the curated lexicon collapse to a shared concept
 * dimension (so paraphrases with synonyms score as similar); out-of-lexicon
 * words are feature-hashed. It is crude compared with a real neural embedder,
 * but it is free, private (nothing leaves the device), fully deterministic,
 * and improves recall beyond pure lexical matching. A configured HTTP provider
 * (see `/api/embed`) supersedes it for the durable index.
 */

import type { EmbeddingProvider, EmbeddingVector } from "@/lib/embeddings/types";

export const LOCAL_MODEL = "lexical-v1";
export const LOCAL_PROVIDER = "local";

// Synonym clusters — each maps to ONE dimension so paraphrases collapse.
const CONCEPT_GROUPS: string[][] = [
  ["consciousness", "awareness", "sentience", "mind", "conscious", "aware", "sentient", "psyche"],
  ["fundamental", "basic", "primary", "essential", "foundational", "elemental", "intrinsic", "irreducible"],
  ["attention", "focus", "concentration", "attentive", "mindful", "mindfulness", "notice", "noticing"],
  ["devotion", "worship", "reverence", "prayer", "sacred", "holy", "devout", "piety"],
  ["distraction", "noise", "scattered", "fragment", "fragmented", "distracted", "restless"],
  ["freedom", "liberty", "autonomy", "free", "independence", "self-determination", "liberation"],
  ["mastery", "discipline", "control", "restraint", "self-mastery", "willpower", "temperance"],
  ["knowledge", "understanding", "wisdom", "insight", "knowing", "comprehension", "epistemic"],
  ["belief", "conviction", "creed", "faith", "doctrine", "tenet", "believe"],
  ["truth", "true", "reality", "real", "actual", "veridical", "fact"],
  ["experience", "lived", "phenomenal", "qualia", "felt", "subjective", "firsthand"],
  ["memory", "remember", "recollection", "recall", "remembrance", "retention"],
  ["identity", "self", "selfhood", "ego", "personhood", "individuality"],
  ["silence", "stillness", "quiet", "solitude", "contemplation", "contemplative", "meditation"],
  ["change", "transform", "transformation", "evolve", "evolution", "becoming", "flux"],
  ["nonduality", "nondual", "oneness", "unity", "monism", "unitive", "advaita"],
  ["dualism", "dual", "separation", "duality", "divided", "opposition"],
  ["matter", "material", "physical", "body", "brain", "substrate", "corporeal"],
  ["spirit", "soul", "spiritual", "transcendent", "divine", "immaterial"],
  ["ethics", "moral", "virtue", "good", "right", "ought", "duty"],
  ["suffering", "pain", "grief", "sorrow", "anguish", "affliction"],
  ["joy", "happiness", "flourishing", "wellbeing", "eudaimonia", "contentment", "delight"],
  ["reason", "logic", "rational", "argument", "inference", "deduction", "premise"],
  ["doubt", "skeptic", "skepticism", "question", "uncertainty", "questioning"],
  ["tradition", "custom", "heritage", "lineage", "convention", "orthodox"],
  ["language", "word", "term", "meaning", "semantics", "vocabulary", "definition"],
  ["time", "temporal", "history", "historical", "duration", "chronological"],
  ["nature", "natural", "world", "cosmos", "universe", "creation"],
  ["love", "compassion", "charity", "kindness", "benevolence", "agape"],
  ["fear", "anxiety", "dread", "terror", "worry", "apprehension"],
  ["desire", "want", "longing", "craving", "yearning", "appetite"],
  ["habit", "practice", "routine", "ritual", "discipline", "regimen"],
  ["community", "relationship", "social", "others", "fellowship", "communion"],
  ["work", "labor", "vocation", "craft", "calling", "profession"],
  ["death", "mortality", "finitude", "dying", "impermanence", "mortal"],
  ["hope", "aspiration", "expectation", "optimism", "promise"],
  ["power", "force", "strength", "authority", "dominion", "potency"],
  ["order", "structure", "pattern", "system", "organization", "form"],
  ["chaos", "disorder", "entropy", "randomness", "confusion"],
  ["question", "inquiry", "investigation", "examine", "probe", "explore"],
];

const HASH_BUCKETS = 88;
export const LOCAL_DIMENSIONS = CONCEPT_GROUPS.length + HASH_BUCKETS;

const WORD_TO_GROUP = new Map<string, number>();
CONCEPT_GROUPS.forEach((group, gi) => {
  for (const w of group) WORD_TO_GROUP.set(w, gi);
});

const STOP = new Set([
  "the", "and", "for", "are", "but", "not", "you", "that", "this", "with", "from",
  "have", "what", "your", "they", "them", "into", "when", "will", "would", "there",
  "their", "about", "which", "were", "been", "some", "such", "than", "then", "its",
  "was", "has", "his", "her", "our", "out", "can", "all", "any", "how", "who",
]);

function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t));
}

function bucket(word: string): number {
  let h = 0;
  for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) | 0;
  return CONCEPT_GROUPS.length + (Math.abs(h) % HASH_BUCKETS);
}

/** Deterministic local embedding: L2-normalized bag-of-concepts. */
export function localEmbed(text: string): EmbeddingVector {
  const v = new Array(LOCAL_DIMENSIONS).fill(0);
  for (const t of tokens(text)) {
    const gi = WORD_TO_GROUP.get(t);
    // Concept-group hits weigh more than raw hashed tokens (synonyms matter).
    if (gi != null) v[gi] += 1.6;
    else v[bucket(t)] += 1;
  }
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (norm === 0) return v;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

/** Cosine similarity of two vectors (0..1 for these non-negative embeddings). */
export function cosine(a: EmbeddingVector, b: EmbeddingVector): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export const localProvider: EmbeddingProvider = {
  name: LOCAL_PROVIDER,
  model: LOCAL_MODEL,
  dimensions: LOCAL_DIMENSIONS,
  health() {
    return { configured: true, provider: LOCAL_PROVIDER, model: LOCAL_MODEL, dimensions: LOCAL_DIMENSIONS };
  },
  embed(text: string) {
    return localEmbed(text);
  },
  embedBatch(texts: string[]) {
    return texts.map(localEmbed);
  },
};
