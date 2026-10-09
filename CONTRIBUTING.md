# Contributing to Patternwise

Thanks for helping. Patternwise is a free place to learn DSA patterns, low-level design, system design and AI
engineering, then practise with an AI mock interviewer. Most contributions are **content** — a clearer explanation,
a new lesson, a better problem — and you don't need to know React to make one.

## Ways to help

| You want to… | Where | Difficulty |
| --- | --- | --- |
| Fix a typo, a wrong fact or a broken LeetCode link | any `.md` file under `frontend/src/content/` or `frontend/src/content/dsa/patterns.ts` | ⭐ |
| Improve an explanation or add an "In the interview" Q&A | the lesson's `.md` file | ⭐ |
| Add a lesson or a practice problem to LLD / HLD / AI | `curriculum.ts` + a new `.md` file | ⭐⭐ |
| Add a DSA problem to a pattern's ladder | `frontend/src/content/dsa/patterns.ts` | ⭐ |
| Add a whole new DSA pattern with a visualizer | `patterns.ts` + `src/lib/dsa/viz/` | ⭐⭐⭐ |
| Improve the UI, accessibility or performance | `frontend/src/components/`, `frontend/src/app/` | ⭐⭐ |
| Improve the AI interviewer | `backend/app/` | ⭐⭐⭐ |

Look for issues labelled **good first issue** or **content** if you want somewhere to start. If you're planning
something big (a new track, a new visualizer type), open an issue first so we can agree on the shape.

## Workflow

1. **Fork** the repo on GitHub and clone your fork.
2. Create a branch: `git checkout -b content/better-sliding-window-analogy` (or `fix/…`, `feat/…`).
3. Make your change and run the checks below.
4. Push to your fork and open a **pull request** against `main`. Fill in the PR template.
5. CI runs lint, type-check, content checks and a production build. A maintainer reviews and merges.

Small PRs get merged fastest. One lesson or one fix per PR is perfect.

## Running it locally

You only need the frontend for content work:

```bash
cd frontend
npm install
npm run dev            # http://localhost:3000
```

The mock interviewer at `/interview` needs the backend too (Python 3.12 + a free Groq API key) — see the
[README](README.md#setup).

Before you push:

```bash
cd frontend
npm run lint
npm run typecheck
npm run check:content  # slugs ↔ files, no H1s, visualizers registered, etc.
npm run build
```

## How content is organised

```text
frontend/src/content/
├── dsa/patterns.ts          # all 18 DSA patterns: analogy, cues, steps, variations, mistakes, problems
├── lld/
│   ├── curriculum.ts        # stages → modules → lessons, plus the practice list
│   ├── lessons/<slug>.md    # one file per lesson
│   └── practice/<slug>.md   # one file per practice problem
├── hld/  (same shape)
└── ai/   (same shape; "practice" = build projects)

frontend/src/lib/dsa/viz/    # step-through visualizers (one trace function per pattern)
```

The schema for tracks is in `frontend/src/lib/content/types.ts`; for DSA patterns it's
`frontend/src/lib/dsa/content-types.ts`. TypeScript will tell you if a field is missing.

### Add a lesson (LLD / HLD / AI)

1. Add an entry to the right module in `frontend/src/content/<track>/curriculum.ts`:
   ```ts
   { slug: "bloom-filters", title: "Bloom Filters", summary: "One sentence for the card.", minutes: 8 },
   ```
2. Create `frontend/src/content/<track>/lessons/bloom-filters.md`.
3. Run `npm run check:content`.

### Add a practice problem

Same idea: add to `practice: [...]` in `curriculum.ts` with `level`, `concepts`, `minutes`, `summary`, then create
`practice/<slug>.md`. The **first `##` section is shown as the brief**; everything after it is hidden behind
"Reveal reference solution", so put requirements first.

### Add a problem to a DSA pattern

Append to that pattern's `problems` array in `patterns.ts`. Keep the ladder ordered Easy → Hard. `lc` must be the
exact slug from `leetcode.com/problems/<slug>/`, and please avoid premium-only problems.

### Add a new DSA pattern + visualizer

1. Write a `VizSpec` in `frontend/src/lib/dsa/viz/` — a Python `code` string and a `trace(inputs)` function that runs
   the algorithm once and records a `Frame` per step (`line` is the 1-based line of `code` to highlight). Reuse the
   existing view kinds (`array`, `graph`, `grid`, `table`, `intervals`) where you can; `twoPointers` in `arrays.ts`
   is the simplest example to copy.
2. Register it in `frontend/src/lib/dsa/viz/index.ts` under the pattern's slug.
3. Add the `PatternContent` entry to `patterns.ts`.
4. `npm run check:content` replays every trace and checks the line numbers.

## Content style guide

- **Plain English first.** Open with an everyday analogy before any jargon. If a smart non-engineer couldn't follow
  the first paragraph, simplify it.
- **Explain *why*, not just *what*.** "Why is this fast?" and "when would you not use this?" are the parts people remember.
- **Python** for code (it's what most candidates use in interviews). Keep examples under ~50 lines, typed, and runnable.
- **No H1** (`#`) in markdown — the page renders the title. Start sections at `##`.
- Diagrams as ` ```text ` blocks with ASCII boxes and arrows.
- Lessons end with `## Common mistakes`, `## In the interview` (questions + short answers) and `## Key takeaways`.
- **Write it yourself.** Don't paste from books, courses, paid platforms or other websites — link to them instead.
  Contributions must be your own work so they can be released under this project's licence.
- Avoid facts that go stale fast (exact model names, prices, limits). Say "at the time of writing" if you must.

## Licensing of contributions

By opening a pull request you agree that your code is licensed under the [MIT licence](LICENSE) and your written
content under [CC BY 4.0](LICENSE-CONTENT.md), the same as the rest of the project.

## Code of conduct

Be kind and assume good intent. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
