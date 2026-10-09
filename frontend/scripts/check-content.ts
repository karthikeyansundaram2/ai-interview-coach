/**
 * Content checks that run in CI on every pull request.
 *   npm run check:content
 *
 * Catches the mistakes contributors are most likely to make:
 * a slug in curriculum.ts with no matching .md (or the reverse), duplicate slugs,
 * an H1 inside a lesson, an unclosed code fence, a DSA pattern without a visualizer,
 * and malformed LeetCode slugs.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ai } from "../src/content/ai/curriculum";
import { PATTERNS } from "../src/content/dsa/patterns";
import { hld } from "../src/content/hld/curriculum";
import { lld } from "../src/content/lld/curriculum";
import type { Track } from "../src/lib/content/types";
import { VIZ } from "../src/lib/dsa/viz";
import { inputsOf } from "../src/lib/dsa/viz/helpers";

const root = path.join(__dirname, "..", "src", "content");
const errors: string[] = [];
const err = (m: string) => errors.push(m);

function checkMarkdown(file: string) {
  const md = readFileSync(file, "utf8");
  const rel = path.relative(process.cwd(), file);
  let inFence = false;
  md.split("\n").forEach((line, i) => {
    if (line.trimStart().startsWith("```")) inFence = !inFence;
    if (!inFence && /^# /.test(line)) err(`${rel}:${i + 1} uses an H1 — the page renders the title, start sections at ##`);
  });
  if (inFence) err(`${rel}: unclosed \`\`\` code fence`);
  if (/^---\n/.test(md)) err(`${rel}: front-matter is not supported — metadata lives in curriculum.ts`);
  if (md.trim().length < 200) err(`${rel}: looks empty (under 200 characters)`);
}

function checkTrack(t: Track) {
  for (const [kind, slugs] of [
    ["lessons", t.stages.flatMap((s) => s.modules.flatMap((m) => m.lessons.map((l) => l.slug)))],
    ["practice", t.practice.map((p) => p.slug)],
  ] as const) {
    const dir = path.join(root, t.slug, kind);
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)) : [];
    const seen = new Set<string>();
    for (const s of slugs) {
      if (seen.has(s)) err(`${t.slug}/${kind}: duplicate slug "${s}" in curriculum.ts`);
      seen.add(s);
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) err(`${t.slug}/${kind}: slug "${s}" must be kebab-case`);
      if (!files.includes(s)) err(`${t.slug}/${kind}: "${s}" is in curriculum.ts but ${kind}/${s}.md is missing`);
    }
    for (const f of files) if (!seen.has(f)) err(`${t.slug}/${kind}: ${f}.md exists but isn't listed in curriculum.ts`);
    for (const f of files) checkMarkdown(path.join(dir, `${f}.md`));
  }
  const modSlugs = t.stages.flatMap((s) => s.modules.map((m) => m.slug));
  if (new Set(modSlugs).size !== modSlugs.length) err(`${t.slug}: duplicate module slug`);
}

[lld, hld, ai].forEach(checkTrack);

const patternSlugs = new Set<string>();
for (const p of PATTERNS) {
  if (patternSlugs.has(p.slug)) err(`dsa: duplicate pattern slug "${p.slug}"`);
  patternSlugs.add(p.slug);
  if (!VIZ[p.slug]) err(`dsa/${p.slug}: no visualizer registered in src/lib/dsa/viz/index.ts`);
  if (p.problems.length < 3) err(`dsa/${p.slug}: needs at least 3 practice problems`);
  const lcs = new Set<string>();
  for (const q of p.problems) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(q.lc)) err(`dsa/${p.slug}: "${q.lc}" doesn't look like a LeetCode slug`);
    if (lcs.has(q.lc)) err(`dsa/${p.slug}: "${q.lc}" listed twice`);
    lcs.add(q.lc);
  }
}
for (const k of Object.keys(VIZ)) {
  if (!patternSlugs.has(k)) err(`viz: "${k}" is registered but has no pattern in src/content/dsa/patterns.ts`);
  const spec = VIZ[k];
  try {
    const frames = spec.trace(inputsOf(spec));
    const lines = spec.code.split("\n").length;
    if (!frames.length) err(`viz/${k}: trace produced no frames`);
    frames.forEach((f, i) => {
      if (f.line < 1 || f.line > lines) err(`viz/${k}: frame ${i} points at line ${f.line}, code has ${lines} lines`);
    });
  } catch (e) {
    err(`viz/${k}: trace threw — ${(e as Error).message}`);
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} content problem(s):\n` + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
const lessons = [lld, hld, ai].reduce((n, t) => n + t.stages.reduce((m, s) => m + s.modules.reduce((k, mod) => k + mod.lessons.length, 0), 0), 0);
console.log(`✓ content OK — ${PATTERNS.length} DSA patterns, ${lessons} lessons, ${[lld, hld, ai].reduce((n, t) => n + t.practice.length, 0)} practice items`);
