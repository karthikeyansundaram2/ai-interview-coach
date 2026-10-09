import type { Level } from "@/lib/content/types";

export interface PatternProblem {
  title: string;
  /** exact leetcode.com/problems/<slug>/ slug */
  lc: string;
  level: Level;
  /** one-line nudge that points at the pattern without giving the solution away */
  hint: string;
  /** a few companies known to ask it (best-effort, may be empty) */
  companies?: string[];
}

export interface PatternContent {
  slug: string;
  name: string;
  category: string;
  /** 1-line hook shown on the card */
  tagline: string;
  /** everyday analogy, 2–3 sentences, plain English, zero jargon */
  analogy: string;
  /** the core insight: why this pattern turns brute force into something fast (markdown allowed) */
  insight: string;
  /** "spot it when…" recognition cues, 4–6 bullets, phrased as things you'd read in a problem statement */
  cues: string[];
  /** how to apply, 3–5 ordered steps */
  steps: string[];
  /** brute force vs pattern */
  complexity: { brute: string; pattern: string; space: string };
  /** common variations; code is optional Python */
  variations: { name: string; note: string; code?: string }[];
  /** common mistakes, 3–5 bullets */
  mistakes: string[];
  /** easy → hard ladder, 5–8 problems */
  problems: PatternProblem[];
}
