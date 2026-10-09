// Shared schema for the LLD / HLD / AI tracks.
// Curriculum metadata lives in src/content/<track>/curriculum.ts;
// lesson bodies live in src/content/<track>/lessons/<lessonSlug>.md
// practice bodies live in src/content/<track>/practice/<problemSlug>.md

export type Level = "Easy" | "Medium" | "Hard";

export interface LessonMeta {
  /** unique within the track, kebab-case, matches the .md filename */
  slug: string;
  title: string;
  /** one sentence, shown on cards */
  summary: string;
  minutes: number;
}

export interface Module {
  slug: string;
  title: string;
  /** one or two sentences: what you'll be able to do after this module */
  outcome: string;
  lessons: LessonMeta[];
}

export interface Stage {
  name: string;
  blurb: string;
  modules: Module[];
}

export interface PracticeMeta {
  /** unique within the track, kebab-case, matches the .md filename */
  slug: string;
  title: string;
  level: Level;
  /** 2–4 short concept tags */
  concepts: string[];
  minutes: number;
  /** one sentence */
  summary: string;
}

export interface Track {
  slug: "lld" | "hld" | "ai";
  name: string;
  tagline: string;
  intro: string;
  stages: Stage[];
  practiceLabel: string; // e.g. "LLD Problems", "Design Problems", "Build Projects"
  practiceIntro: string;
  practice: PracticeMeta[];
}
