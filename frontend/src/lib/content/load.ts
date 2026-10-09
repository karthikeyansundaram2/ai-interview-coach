import { readFileSync } from "node:fs";
import path from "node:path";
import { ai } from "@/content/ai/curriculum";
import { hld } from "@/content/hld/curriculum";
import { lld } from "@/content/lld/curriculum";
import type { LessonMeta, Module, Stage, Track } from "./types";

export const TRACKS: Record<Track["slug"], Track> = { lld, hld, ai };
export const TRACK_SLUGS = Object.keys(TRACKS) as Track["slug"][];

export function getTrack(slug: string): Track | null {
  return (TRACKS as Record<string, Track>)[slug] ?? null;
}

export interface FlatLesson extends LessonMeta {
  module: Module;
  stage: Stage;
  index: number;
}

export function flatLessons(track: Track): FlatLesson[] {
  const out: FlatLesson[] = [];
  for (const stage of track.stages) for (const mod of stage.modules) for (const l of mod.lessons) out.push({ ...l, module: mod, stage, index: out.length });
  return out;
}

function readMd(track: string, kind: "lessons" | "practice", slug: string): string | null {
  try {
    return readFileSync(path.join(process.cwd(), "src", "content", track, kind, `${slug}.md`), "utf8");
  } catch {
    return null;
  }
}

export const getLessonBody = (track: string, slug: string) => readMd(track, "lessons", slug);
export const getPracticeBody = (track: string, slug: string) => readMd(track, "practice", slug);

export function trackStats(t: Track) {
  const lessons = flatLessons(t);
  return {
    modules: t.stages.reduce((n, s) => n + s.modules.length, 0),
    lessons: lessons.length,
    minutes: lessons.reduce((n, l) => n + l.minutes, 0),
    practice: t.practice.length,
  };
}
