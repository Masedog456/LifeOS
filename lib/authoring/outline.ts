/**
 * Outline generation (LIFEOS-019, Phase 4).
 *
 * Produces MULTIPLE candidate outlines the user compares and chooses between —
 * deterministic per-kind templates seeded with the project's own evidence,
 * plus (optionally) one AI-proposed outline. Nothing is chosen automatically.
 */

import type { KnowledgeProject, OutlineOption, ProjectEvidence, ProjectKind, StoreState } from "@/types/mvp";
import { assembleEvidence } from "@/lib/authoring/assembly";
import { generateOutlines } from "@/lib/aiClient";

function id(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? `${prefix}_${crypto.randomUUID()}` : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

const KIND_LABEL: Record<ProjectKind, string> = {
  book: "Book", essay: "Essay", lecture: "Lecture", course: "Course",
  research_paper: "Research paper", blog_series: "Blog series", guide: "Guide", philosophy: "Personal philosophy",
};
export function projectKindLabel(k: ProjectKind): string {
  return KIND_LABEL[k];
}

/** Section skeletons per kind — the deterministic backbone. */
const TEMPLATES: Record<ProjectKind, { heading: string; purpose: string }[]> = {
  book: [
    { heading: "Introduction", purpose: "Frame the question the book answers and why it matters." },
    { heading: "Foundations", purpose: "Establish the core concepts the argument rests on." },
    { heading: "Development", purpose: "Build the central argument across your strongest evidence." },
    { heading: "Tensions & objections", purpose: "Face the strongest counter-cases honestly." },
    { heading: "Synthesis", purpose: "Draw the threads together into a coherent view." },
    { heading: "Conclusion", purpose: "State what you now hold, and what remains open." },
  ],
  essay: [
    { heading: "Opening", purpose: "State the claim and the stakes in a few sentences." },
    { heading: "The case", purpose: "Make the argument from your evidence." },
    { heading: "The counter-case", purpose: "Give the objection its full force." },
    { heading: "Resolution", purpose: "Say where you land and why." },
  ],
  lecture: [
    { heading: "Hook", purpose: "Open with the question that makes this worth an hour." },
    { heading: "Key ideas", purpose: "Teach the two or three concepts that matter most." },
    { heading: "Worked example", purpose: "Show the ideas doing real work." },
    { heading: "Takeaways", purpose: "Leave the audience with what to remember." },
  ],
  course: [
    { heading: "Overview & goals", purpose: "What the learner will be able to do by the end." },
    { heading: "Module 1: Foundations", purpose: "The concepts everything else depends on." },
    { heading: "Module 2: Depth", purpose: "The harder material and its evidence." },
    { heading: "Module 3: Application", purpose: "Putting it into practice." },
    { heading: "Assessment & further study", purpose: "How to check understanding and go deeper." },
  ],
  research_paper: [
    { heading: "Abstract", purpose: "One-paragraph summary of question, method, and finding." },
    { heading: "Introduction", purpose: "Situate the question in what came before." },
    { heading: "Argument / analysis", purpose: "The core reasoning, grounded in evidence." },
    { heading: "Discussion", purpose: "What follows, and the limitations." },
    { heading: "Conclusion", purpose: "The contribution and open questions." },
  ],
  blog_series: [
    { heading: "Part 1: The problem", purpose: "Why this series exists." },
    { heading: "Part 2: The idea", purpose: "The central insight, plainly." },
    { heading: "Part 3: The evidence", purpose: "What convinced you." },
    { heading: "Part 4: What to do with it", purpose: "The practical upshot." },
  ],
  guide: [
    { heading: "Why this matters", purpose: "The reason to read on." },
    { heading: "Core principles", purpose: "The few rules that carry the most weight." },
    { heading: "Step by step", purpose: "The practical sequence." },
    { heading: "Pitfalls", purpose: "What goes wrong and how to avoid it." },
  ],
  philosophy: [
    { heading: "What I take to be real", purpose: "The ground you actually stand on." },
    { heading: "How I come to know", purpose: "Your epistemics, honestly stated." },
    { heading: "What matters and why", purpose: "Your values and their roots." },
    { heading: "How I mean to live", purpose: "The practices that follow." },
    { heading: "What remains unresolved", purpose: "The honest edges of your view." },
  ],
};

/** Seed a couple of concrete section headings from the strongest evidence. */
function evidenceSeededSections(evidence: ProjectEvidence[]): { heading: string; purpose: string }[] {
  const concepts = evidence.filter((e) => e.kind === "concept").slice(0, 3);
  const threads = evidence.filter((e) => e.kind === "thread").slice(0, 2);
  const out: { heading: string; purpose: string }[] = [];
  for (const c of concepts) out.push({ heading: c.label, purpose: `Develop the concept “${c.label}” using its grounded evidence.` });
  for (const t of threads) out.push({ heading: t.label, purpose: `Trace the thread “${t.label}” as a chapter of its own.` });
  return out;
}

/** Deterministic outline candidates: the template, and a template woven with evidence-seeded sections. */
export function deterministicOutlines(state: StoreState, project: KnowledgeProject): OutlineOption[] {
  const evidence = assembleEvidence(state, project.assembly);
  const base = TEMPLATES[project.kind] ?? TEMPLATES.essay;
  const seeded = evidenceSeededSections(evidence);

  const options: OutlineOption[] = [
    {
      id: id("outline"),
      kind: project.kind,
      title: `${KIND_LABEL[project.kind]}: ${project.title}`,
      rationale: `A conventional ${KIND_LABEL[project.kind].toLowerCase()} structure — a reliable backbone you can reorder.`,
      sections: base,
      source: "deterministic",
    },
  ];

  if (seeded.length > 0) {
    // A structure that centers your own concepts/threads as chapters.
    const woven = [base[0], ...seeded, ...base.slice(1)];
    options.push({
      id: id("outline"),
      kind: project.kind,
      title: `${KIND_LABEL[project.kind]} (evidence-led): ${project.title}`,
      rationale: "Built around your own concepts and threads as first-class sections, framed by the standard opening and close.",
      sections: woven,
      source: "deterministic",
    });
  }
  return options;
}

export function estimateOutline(state: StoreState, project: KnowledgeProject) {
  return { calls: 1, evidenceCount: assembleEvidence(state, project.assembly).length };
}

/** Generate candidate outlines: deterministic first, then append one AI candidate. */
export async function runOutlineGeneration(
  state: StoreState,
  project: KnowledgeProject,
): Promise<{ options: OutlineOption[]; source: "ai" | "mock" }> {
  const det = deterministicOutlines(state, project);
  const evidence = assembleEvidence(state, project.assembly);
  const { result: raw, source } = await generateOutlines({
    evidence,
    kind: project.kind,
    title: project.title,
    purpose: project.purpose,
    audience: project.audience,
  });

  const aiOptions: OutlineOption[] = [];
  const arr = (raw && typeof raw === "object" && Array.isArray((raw as { outlines?: unknown }).outlines))
    ? ((raw as { outlines: unknown[] }).outlines)
    : [];
  for (const o of arr.slice(0, 2)) {
    const obj = (o && typeof o === "object" ? o : {}) as Record<string, unknown>;
    const sections = Array.isArray(obj.sections)
      ? obj.sections
          .map((s) => {
            const so = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
            return { heading: String(so.heading ?? "").trim(), purpose: String(so.purpose ?? "").trim() };
          })
          .filter((s) => s.heading)
          .slice(0, 12)
      : [];
    if (sections.length < 2) continue;
    aiOptions.push({
      id: id("outline"),
      kind: project.kind,
      title: String(obj.title ?? project.title).trim().slice(0, 160) || project.title,
      rationale: String(obj.rationale ?? "AI-proposed structure.").trim().slice(0, 300),
      sections,
      source: source === "ai" ? "ai" : "mock",
    });
  }
  return { options: [...det, ...aiOptions], source };
}
