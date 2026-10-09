import Link from "next/link";
import { ContinueBanner } from "@/components/ContinueBanner";
import { PageShell } from "@/components/SiteHeader";
import { Visualizer } from "@/components/dsa/Visualizer";
import { IconArrowRight } from "@/components/icons";
import { PATTERNS } from "@/content/dsa/patterns";
import { TRACKS, trackStats } from "@/lib/content/load";
import { SITE_NAME } from "@/lib/site";

const BANDS = [
  { range: "85+", label: "Excellent", tone: "text-good" },
  { range: "70", label: "Good", tone: "text-good" },
  { range: "55", label: "Adequate", tone: "text-okay" },
  { range: "<55", label: "Weak", tone: "text-weak" },
];

export default function HomePage() {
  const lld = trackStats(TRACKS.lld);
  const hld = trackStats(TRACKS.hld);
  const ai = trackStats(TRACKS.ai);
  const problems = PATTERNS.reduce((n, p) => n + p.problems.length, 0);

  const CARDS = [
    { n: "01", href: "/dsa", title: "DSA by pattern", body: "18 patterns, each with an analogy, a step-through visualizer and an easy → hard ladder.", meta: `${PATTERNS.length} patterns · ${problems} problems`, tags: ["Two pointers", "Sliding window", "Graphs", "DP"] },
    { n: "02", href: "/lld", title: "Low-level design", body: "OOP, SOLID and the design patterns that matter, then classic machine-coding problems.", meta: `${lld.lessons} lessons · ${lld.practice} problems`, tags: ["SOLID", "Patterns", "Concurrency"] },
    { n: "03", href: "/hld", title: "System design", body: "From DNS to multi-region: caching, sharding, queues, consensus — then full design walkthroughs.", meta: `${hld.lessons} lessons · ${hld.practice} problems`, tags: ["Caching", "Sharding", "Kafka", "CAP"] },
    { n: "04", href: "/ai", title: "AI engineering", body: "Transformers to production: RAG, agents, MCP, LangGraph, evals, guardrails and serving.", meta: `${ai.lessons} lessons · ${ai.practice} projects`, tags: ["RAG", "Agents", "MCP", "Evals"] },
    { n: "05", href: "/prep", title: "Interview prep", body: "An 8-week plan, a playbook for every round and the frameworks to use in the room.", meta: "8 weeks · 6 rounds", tags: ["Plan", "Behavioural", "Frameworks"] },
    { n: "06", href: "/interview", title: "Mock interview", body: "An AI interviewer that asks one question at a time, probes your gaps and grades you honestly.", meta: "Pass / Fail · scored /100", tags: ["Resume-aware", "6 rounds"] },
  ];

  return (
    <PageShell>
      <ContinueBanner />
      {/* hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="ruled pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-6xl px-5 pt-16 pb-16 lg:pt-24 lg:pb-24">
          <p className="eyebrow text-accent">DSA · LLD · HLD · AI · Interviews</p>
          <h1 className="display mt-5 text-[clamp(2.75rem,9vw,6.5rem)]">
            Learn the pattern.
            <br />
            Pass the <span className="serif-italic text-accent">loop.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
            {SITE_NAME} teaches engineering interviews the way they actually work: recognise the pattern, understand why it&apos;s
            fast, practise it on a ladder, then defend it in a mock interview that doesn&apos;t go easy on you.
          </p>
          <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
            <Link href="/dsa" className="inline-flex min-h-13 items-center justify-center gap-2 bg-accent px-7 text-base font-semibold text-accent-fg transition-colors hover:bg-accent-strong">
              Start with DSA patterns <IconArrowRight className="size-4" />
            </Link>
            <Link href="/prep" className="underline-cta self-start text-base sm:self-auto">
              See the 8-week plan
            </Link>
          </div>
        </div>
      </section>

      {/* tracks */}
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-20">
          <p className="eyebrow text-accent">What do you want to master?</p>
          <h2 className="display mt-4 text-3xl sm:text-5xl">Six tracks. One loop.</h2>
          <div className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {CARDS.map((c) => (
              <Link key={c.href} href={c.href} className="group flex flex-col bg-bg p-6 transition-colors hover:bg-surface">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-3xl font-semibold text-border-strong transition-colors group-hover:text-accent">{c.n}</span>
                  <span className="font-mono text-[11px] text-faint">{c.meta}</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">{c.title}</h3>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">{c.body}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {c.tags.map((t) => (
                    <span key={t} className="border border-border px-1.5 py-0.5 font-mono text-[10.5px] text-faint">{t}</span>
                  ))}
                </div>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-fg group-hover:text-accent">
                  Open <IconArrowRight className="size-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* live visualizer */}
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow text-accent">See it run</p>
              <h2 className="display mt-4 text-3xl sm:text-5xl">
                Don&apos;t memorise code. <span className="serif-italic text-muted">Watch it think.</span>
              </h2>
            </div>
            <p className="max-w-md text-[15px] leading-relaxed text-muted">
              Every pattern has a visualizer like this one. Press play, step with the arrow keys, or type your own input.
            </p>
          </div>
          <div className="mt-10">
            <Visualizer slug="sliding-window" />
          </div>
          <Link href="/dsa" className="underline-cta mt-8">
            Browse all {PATTERNS.length} patterns <IconArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* loop */}
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-20">
          <p className="eyebrow text-accent">How it works</p>
          <h2 className="display mt-4 text-3xl sm:text-5xl">Learn → Practise → Defend.</h2>
          <ol className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-3">
            {[
              ["01", "Learn", "Structured tracks, ordered by prerequisite. Plain-English explanations first, jargon second."],
              ["02", "Practise", "Pattern ladders, LLD problems and system-design case studies with a timer and a hidden reference answer."],
              ["03", "Defend", "Run a mock interview on what you just learned. The AI probes, doesn't hint, and grades out of 100."],
            ].map(([n, t, b]) => (
              <li key={n} className="bg-bg p-6 sm:p-8">
                <span className="font-mono text-4xl font-semibold text-border-strong">{n}</span>
                <h3 className="mt-6 text-xl font-semibold tracking-tight">{t}</h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* mock interview */}
      <section className="border-b border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-20">
          <div>
            <p className="eyebrow text-accent">Mock interviews</p>
            <h2 className="display mt-4 text-3xl sm:text-5xl">
              It behaves like an interviewer, <span className="serif-italic text-muted">not a tutor.</span>
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-muted">
              Pick a topic and round, optionally upload your resume. One question at a time, follow-ups when you&apos;re vague, and a
              report that quotes your own answers. 55 and above is a pass.
            </p>
            <dl className="mt-8 grid grid-cols-4 gap-px border border-border bg-border">
              {BANDS.map((b) => (
                <div key={b.label} className="bg-bg p-3">
                  <dt className={`font-mono text-2xl font-semibold tabular-nums ${b.tone}`}>{b.range}</dt>
                  <dd className="mt-1 text-xs text-muted">{b.label}</dd>
                </div>
              ))}
            </dl>
            <Link href="/interview" className="mt-8 inline-flex min-h-12 items-center gap-2 bg-accent px-6 font-semibold text-accent-fg hover:bg-accent-strong">
              Start an interview <IconArrowRight className="size-4" />
            </Link>
          </div>
          <aside aria-label="Example of an interview turn" className="border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="eyebrow text-muted">Transcript · Q3</span>
              <span className="eyebrow text-okay">Medium · System design</span>
            </div>
            <div className="space-y-4 px-4 py-5 text-[15px] leading-relaxed">
              <p>
                <span className="eyebrow mr-2 text-accent">Interviewer</span>
                On your resume you mention cutting p95 latency by 40% with Redis. How did you decide what to cache, and how did you keep it consistent on writes?
              </p>
              <p className="text-muted">
                <span className="eyebrow mr-2 text-faint">You</span>
                We used cache-aside with a five-minute TTL and deleted keys on write…
              </p>
              <p>
                <span className="eyebrow mr-2 text-accent">Interviewer</span>
                Good. What happens when a hot key expires under a traffic spike?
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-xs text-faint">Ends when a real interviewer would</span>
              <span className="font-mono text-2xl font-semibold tabular-nums text-good">
                72<span className="text-sm text-faint">/100</span>
              </span>
            </div>
          </aside>
        </div>
      </section>

      <section>
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-5 py-20 lg:flex-row lg:items-center lg:justify-between lg:py-24">
          <h2 className="display text-[clamp(2.25rem,7vw,5rem)]">
            Ready when <span className="serif-italic text-accent">you</span> are.
          </h2>
          <Link href="/dsa/two-pointers" className="inline-flex min-h-13 items-center justify-center gap-2 bg-accent px-7 text-base font-semibold text-accent-fg hover:bg-accent-strong">
            Pattern #1: Two Pointers <IconArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
