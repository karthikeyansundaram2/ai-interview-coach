import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/SiteHeader";
import { PatternProgress } from "@/components/dsa/ProblemList";
import { IconArrowRight } from "@/components/icons";
import { PATTERNS } from "@/content/dsa/patterns";

export const metadata: Metadata = { title: "DSA by pattern" };

const HOW = [
  { n: "01", t: "Get the idea", b: "An everyday analogy and the one insight that makes the pattern fast." },
  { n: "02", t: "Watch it run", b: "Step through the algorithm line by line, or type your own input." },
  { n: "03", t: "Solve the ladder", b: "6–8 LeetCode problems, easy to hard, with hints that don't spoil it." },
  { n: "04", t: "Get grilled", b: "Run a mock interview on the pattern and get an honest score." },
];

export default function DsaPage() {
  const categories = [...new Set(PATTERNS.map((p) => p.category))];
  const total = PATTERNS.reduce((n, p) => n + p.problems.length, 0);
  return (
    <PageShell>
      <section className="relative overflow-hidden border-b border-border">
        <div className="ruled pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-6xl px-5 pt-14 pb-14 lg:pt-20">
          <p className="eyebrow text-accent">Data structures & algorithms</p>
          <h1 className="display mt-4 text-[clamp(2.5rem,7vw,5rem)]">
            Learn the <span className="serif-italic text-accent">pattern,</span>
            <br />
            not 500 problems.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            Most interview problems are one of about eighteen patterns in disguise. Learn to recognise them, watch each one run
            step by step, then practise on a curated ladder.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4 font-mono">
            <Stat n={PATTERNS.length} l="patterns" />
            <Stat n={total} l="problems" />
            <Stat n={PATTERNS.length} l="visualizers" />
          </div>
          <div className="mt-8 flex flex-wrap gap-6">
            <Link href={`/dsa/${PATTERNS[0].slug}`} className="inline-flex min-h-12 items-center gap-2 bg-accent px-6 font-semibold text-accent-fg transition-colors hover:bg-accent-strong">
              Start with Two Pointers <IconArrowRight className="size-4" />
            </Link>
            <Link href="/dsa/practice" className="underline-cta self-center">
              Open the problem bank
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <ol className="mx-auto grid w-full max-w-6xl gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {HOW.map((h) => (
            <li key={h.n} className="bg-bg px-5 py-6">
              <span className="font-mono text-xs text-accent">{h.n}</span>
              <p className="mt-2 font-semibold tracking-tight">{h.t}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{h.b}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-14">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-accent">Roadmap</p>
            <h2 className="display mt-3 text-3xl sm:text-4xl">Ordered by prerequisite.</h2>
          </div>
          <p className="max-w-md text-sm text-muted">Go top to bottom the first time. Each pattern leans on the ones before it.</p>
        </div>
        <div className="mt-10 space-y-12">
          {categories.map((cat) => (
            <div key={cat}>
              <h3 className="eyebrow mb-4 border-b border-border pb-2 text-muted">{cat}</h3>
              <div className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
                {PATTERNS.filter((p) => p.category === cat).map((p) => {
                  const n = PATTERNS.indexOf(p) + 1;
                  return (
                    <Link key={p.slug} href={`/dsa/${p.slug}`} className="group flex flex-col bg-bg p-5 transition-colors hover:bg-surface">
                      <div className="flex items-baseline justify-between">
                        <span className="font-mono text-3xl font-semibold text-border-strong transition-colors group-hover:text-accent">{String(n).padStart(2, "0")}</span>
                        <span className="font-mono text-[11px] text-faint">{p.problems.length} problems</span>
                      </div>
                      <p className="mt-4 text-lg font-semibold tracking-tight">{p.name}</p>
                      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{p.tagline}</p>
                      <p className="mt-3 font-mono text-[11px] text-faint">spot it: {p.cues.slice(0, 2).join(" · ")}</p>
                      <div className="mt-4">
                        <PatternProgress ids={p.problems.map((q) => `dsa:${q.lc}`)} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto w-full max-w-6xl px-5 py-14">
          <p className="eyebrow text-accent">Cheatsheet</p>
          <h2 className="display mt-3 text-3xl sm:text-4xl">“Which pattern is this?”</h2>
          <p className="mt-3 max-w-2xl text-muted">Read the problem, find the phrase, jump to the pattern. The fastest way to stop staring at a blank editor.</p>
          <div className="mt-8 overflow-x-auto border border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-surface-2">
                <tr>
                  <th className="border-b border-border px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-wide text-muted">If the problem says…</th>
                  <th className="border-b border-border px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-wide text-muted">Reach for</th>
                </tr>
              </thead>
              <tbody>
                {PATTERNS.map((p) => (
                  <tr key={p.slug} className="bg-bg">
                    <td className="border-b border-border px-4 py-3 text-fg/85">{p.cues.slice(0, 3).join(" · ")}</td>
                    <td className="border-b border-border px-4 py-3 whitespace-nowrap">
                      <Link href={`/dsa/${p.slug}`} className="font-medium text-fg underline decoration-accent decoration-2 underline-offset-4 hover:text-accent">
                        {p.name}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div>
      <span className="text-3xl font-semibold tabular-nums text-fg">{n}</span>
      <span className="ml-2 text-xs uppercase tracking-widest text-faint">{l}</span>
    </div>
  );
}
