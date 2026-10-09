import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/SiteHeader";
import { IconArrowRight } from "@/components/icons";

export const metadata: Metadata = { title: "Interview prep", description: "An 8-week plan, round-by-round playbooks and the frameworks to use in the room." };

const WEEKS = [
  { w: "Week 1", focus: "Arrays & strings", dsa: ["two-pointers", "sliding-window", "prefix-sum"], design: "LLD: OOP + SOLID", goal: "15 problems. Say the pattern out loud before you code." },
  { w: "Week 2", focus: "Search & stacks", dsa: ["binary-search", "monotonic-stack", "intervals"], design: "HLD: foundations + estimation", goal: "15 problems + one back-of-envelope per day." },
  { w: "Week 3", focus: "Lists, heaps, greedy", dsa: ["fast-slow-pointers", "linked-list-reversal", "top-k-heap", "greedy"], design: "LLD: creational + structural patterns", goal: "15 problems + design Parking Lot, LRU Cache." },
  { w: "Week 4", focus: "Trees", dsa: ["tree-bfs", "tree-dfs"], design: "HLD: caching, databases, sharding", goal: "15 problems + design URL Shortener." },
  { w: "Week 5", focus: "Graphs", dsa: ["graph-traversal", "topological-sort", "union-find"], design: "LLD: behavioural patterns + concurrency", goal: "15 problems + design Elevator, Rate Limiter." },
  { w: "Week 6", focus: "Backtracking & DP", dsa: ["backtracking", "dp-1d", "dp-2d"], design: "HLD: queues, consistency, reliability", goal: "15 problems + design Chat, News Feed." },
  { w: "Week 7", focus: "Mixed & timed", dsa: [], design: "HLD: advanced + 3 full design problems", goal: "2 timed problems/day from the bank, unseen. 3 mock interviews." },
  { w: "Week 8", focus: "Mocks & polish", dsa: [], design: "Behavioural story bank + AI system design", goal: "1 mock per day across round types. Fix the weakest area only." },
];

const ROUNDS = [
  {
    name: "Phone screen",
    what: "One or two medium problems in ~45 min, often in a shared editor with no autocomplete.",
    signal: "Can you get to working code quickly and talk while you do it?",
    prep: ["Drill Easy/Medium from the first 8 patterns until each takes under 20 minutes.", "Practise typing in a plain editor — no LSP, no run button.", "Have a 60-second 'tell me about yourself' that ends on what you want next."],
    mock: "Phone screen",
  },
  {
    name: "Coding (DSA)",
    what: "1–2 problems, usually Medium with a Hard follow-up. Expect to discuss complexity and test your own code.",
    signal: "Problem decomposition, pattern recognition, clean code, and testing without being told to.",
    prep: ["Use the framework below on every practice problem, not just in mocks.", "Always state brute force first, then improve — interviewers want to see the jump.", "Dry-run your code on a tiny input before saying 'done'."],
    mock: "Technical",
  },
  {
    name: "Low-level design",
    what: "Model a system in classes (Parking Lot, Splitwise, Elevator) and write key parts in ~45–60 min.",
    signal: "Clean abstractions, SOLID, sensible patterns, extensibility, and concurrency awareness.",
    prep: ["Clarify requirements and list entities before drawing anything.", "Name the pattern and why ('Strategy, because pricing rules change').", "Close with how you'd extend it — new vehicle type, new payment method."],
    mock: "Technical",
  },
  {
    name: "System design",
    what: "Design a large-scale service (feed, chat, payments) in 45–60 min. Senior bars expect you to drive.",
    signal: "Requirements discipline, estimation, sound high-level design, depth on 2–3 hard parts, explicit trade-offs.",
    prep: ["Time-box: 5 min requirements, 5 estimates, 10 high-level, 20 deep dives, 5 wrap-up.", "Pick deep dives yourself — the hardest part, not the easiest.", "Every choice gets a 'because' and a 'the cost is…'."],
    mock: "System design",
  },
  {
    name: "Behavioural",
    what: "Stories about conflict, failure, leadership, ambiguity and impact. Often a 'bar raiser' round.",
    signal: "Ownership, judgement, scope and self-awareness — at the level you're interviewing for.",
    prep: ["Build a story bank: 8–10 stories, each tagged with the themes it can answer.", "Use STAR, but spend 60% of the time on Action and quantified Result.", "Say 'I', not 'we', when describing what you did."],
    mock: "Behavioral",
  },
  {
    name: "Hiring manager",
    what: "Past projects in depth, how you work, why this team, what you want next.",
    signal: "Fit, motivation, and whether your experience matches the scope of the role.",
    prep: ["Pick 2 projects you can go 5 levels deep on — design, trade-offs, numbers, mistakes.", "Research the team's product and have 3 real questions.", "Be clear about the level and scope you're targeting."],
    mock: "Hiring manager",
  },
];

const CODING = [
  ["Clarify", "Restate the problem. Ask about input size, ranges, duplicates, negatives, empty input, and what to return when there's no answer. Write 2 examples, including one edge case."],
  ["Match", "Name the brute force and its cost. Then scan for cues: sorted? contiguous? 'next greater'? dependencies? Name the pattern and why it fits."],
  ["Plan", "Say the algorithm in 3–5 plain sentences and its target complexity. Get a nod before you type."],
  ["Implement", "Write clean code with good names. Narrate decisions, not keystrokes. Leave helper functions for later if they're obvious."],
  ["Review", "Dry-run on your small example, then the edge case. Fix bugs out loud — catching your own bug is a positive signal."],
  ["Evaluate", "State time and space. Offer one follow-up improvement or trade-off unprompted."],
];

const CHECK = [
  "Pinned down inputs, outputs and edge cases before writing code",
  "Said the brute force and its complexity first",
  "Named the pattern and why it applies",
  "Dry-ran the code on an example without being asked",
  "Stated final time and space complexity",
  "Kept talking — no silent stretches over a minute",
];

export default function PrepPage() {
  return (
    <PageShell>
      <section className="relative overflow-hidden border-b border-border">
        <div className="ruled pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-6xl px-5 pt-14 pb-12 lg:pt-20">
          <p className="eyebrow text-accent">Interview preparation</p>
          <h1 className="display mt-4 text-[clamp(2.5rem,7vw,5rem)]">
            Eight weeks to <span className="serif-italic text-accent">ready.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            A week-by-week plan that interleaves DSA patterns with design, a playbook for every round you&apos;ll face, and the
            frameworks to use in the room. Finish each week with a mock interview.
          </p>
          <div className="mt-8 flex flex-wrap gap-6">
            <a href="#plan" className="inline-flex min-h-12 items-center gap-2 bg-accent px-6 font-semibold text-accent-fg hover:bg-accent-strong">
              See the plan <IconArrowRight className="size-4" />
            </a>
            <Link href="/interview" className="underline-cta self-center">Start a mock interview</Link>
          </div>
        </div>
      </section>

      <section id="plan" className="scroll-mt-16 mx-auto w-full max-w-6xl px-5 py-14">
        <p className="eyebrow text-accent">The plan</p>
        <h2 className="display mt-3 text-3xl sm:text-4xl">~10 hours a week, in order.</h2>
        <div className="mt-8 overflow-x-auto border border-border">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-surface-2 font-mono text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="border-b border-border px-4 py-2.5">Week</th>
                <th className="border-b border-border px-4 py-2.5">DSA patterns</th>
                <th className="border-b border-border px-4 py-2.5">Design</th>
                <th className="border-b border-border px-4 py-2.5">Goal</th>
              </tr>
            </thead>
            <tbody>
              {WEEKS.map((w) => (
                <tr key={w.w} className="bg-bg align-top">
                  <td className="border-b border-border px-4 py-3">
                    <p className="font-mono text-xs text-accent">{w.w}</p>
                    <p className="mt-1 font-semibold">{w.focus}</p>
                  </td>
                  <td className="border-b border-border px-4 py-3">
                    {w.dsa.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {w.dsa.map((s) => (
                          <Link key={s} href={`/dsa/${s}`} className="border border-border-strong px-2 py-1 font-mono text-[11px] text-muted hover:border-fg hover:text-fg">
                            {s.replace(/-/g, " ")}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <Link href="/dsa/practice" className="text-muted underline decoration-border-strong underline-offset-4 hover:text-fg">Problem bank, mixed</Link>
                    )}
                  </td>
                  <td className="border-b border-border px-4 py-3 text-fg/85">{w.design}</td>
                  <td className="border-b border-border px-4 py-3 text-muted">{w.goal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-y border-border bg-surface/40">
        <div className="mx-auto w-full max-w-6xl px-5 py-14">
          <p className="eyebrow text-accent">In the coding round</p>
          <h2 className="display mt-3 text-3xl sm:text-4xl">Clarify before you code.</h2>
          <p className="mt-3 max-w-2xl text-muted">
            The most common way strong engineers fail: they start typing in minute two, solve a slightly different problem, and
            run out of time fixing it. Six steps, every time.
          </p>
          <ol className="mt-8 grid gap-px border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
            {CODING.map(([t, b], i) => (
              <li key={t} className="bg-bg p-5">
                <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-2 text-lg font-semibold tracking-tight">{t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{b}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 border border-border bg-bg p-5">
            <p className="eyebrow text-faint">Self-check after every practice problem</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {CHECK.map((c) => (
                <li key={c} className="flex items-start gap-2.5 text-sm text-fg/85">
                  <span className="mt-1.5 size-1.5 shrink-0 bg-accent" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-14">
        <p className="eyebrow text-accent">Round by round</p>
        <h2 className="display mt-3 text-3xl sm:text-4xl">Know what each round is scoring.</h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {ROUNDS.map((r) => (
            <div key={r.name} className="flex flex-col border border-border bg-bg">
              <div className="border-b border-border px-5 py-4">
                <h3 className="text-xl font-semibold tracking-tight">{r.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{r.what}</p>
              </div>
              <div className="flex-1 px-5 py-4">
                <p className="eyebrow text-faint">What they&apos;re scoring</p>
                <p className="mt-1.5 text-[15px] text-fg/85">{r.signal}</p>
                <p className="eyebrow mt-4 text-faint">How to prepare</p>
                <ul className="mt-2 space-y-1.5">
                  {r.prep.map((p) => (
                    <li key={p} className="flex gap-2.5 text-sm leading-relaxed text-fg/85">
                      <span className="mt-2 size-1.5 shrink-0 bg-accent" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href={`/interview?round=${encodeURIComponent(r.mock)}&difficulty=Medium`}
                className="flex min-h-12 items-center justify-between border-t border-border px-5 text-sm font-semibold transition-colors hover:bg-surface hover:text-accent"
              >
                Mock a {r.name.toLowerCase()} round <span aria-hidden="true">→</span>
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 lg:grid-cols-2">
          <div>
            <p className="eyebrow text-accent">Behavioural</p>
            <h2 className="display mt-3 text-3xl sm:text-4xl">STAR, weighted.</h2>
            <dl className="mt-6 space-y-4">
              {[
                ["Situation", "10%", "One or two sentences of context. Team, stakes, constraint."],
                ["Task", "10%", "What you specifically owned. Not the team's goal — yours."],
                ["Action", "50%", "The decisions you made and why, including the options you rejected."],
                ["Result", "30%", "A number if possible (latency, revenue, incidents, time saved) and what you learned."],
              ].map(([k, pct, d]) => (
                <div key={k} className="grid grid-cols-[6rem_3rem_1fr] items-baseline gap-3 border-b border-border pb-3">
                  <dt className="font-semibold">{k}</dt>
                  <span className="font-mono text-sm text-accent">{pct}</span>
                  <dd className="text-sm text-muted">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <p className="eyebrow text-accent">Story bank</p>
            <h2 className="display mt-3 text-3xl sm:text-4xl">Have one ready for each.</h2>
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {[
                "A project you led end to end",
                "A production incident you owned",
                "A disagreement with a senior / manager",
                "A time you were wrong",
                "Delivering under an impossible deadline",
                "Mentoring or unblocking someone",
                "Pushing back on a requirement",
                "Ambiguous problem, no clear owner",
                "A trade-off you'd make differently now",
                "Your biggest measurable impact",
              ].map((s) => (
                <li key={s} className="border border-border bg-bg px-3 py-2.5 text-sm text-fg/85">{s}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
