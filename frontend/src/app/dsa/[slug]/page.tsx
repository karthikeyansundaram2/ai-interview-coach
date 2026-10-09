import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Inline } from "@/components/Markdown";
import { PageShell } from "@/components/SiteHeader";
import { ProblemList } from "@/components/dsa/ProblemList";
import { Visualizer } from "@/components/dsa/Visualizer";
import { IconArrowRight } from "@/components/icons";
import { PATTERNS } from "@/content/dsa/patterns";
import { CodeBlock } from "@/lib/highlight";

export const dynamicParams = false;

export function generateStaticParams() {
  return PATTERNS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = PATTERNS.find((x) => x.slug === slug);
  return p ? { title: `${p.name} pattern`, description: p.tagline } : {};
}

const TOC = [
  ["idea", "The idea"],
  ["spot-it", "Spot it"],
  ["visualize", "Visualize"],
  ["apply", "How to apply"],
  ["variations", "Variations"],
  ["mistakes", "Mistakes"],
  ["practice", "Practice"],
] as const;

export default async function PatternPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const i = PATTERNS.findIndex((x) => x.slug === slug);
  if (i < 0) notFound();
  const p = PATTERNS[i];
  const prev = PATTERNS[i - 1];
  const next = PATTERNS[i + 1];

  return (
    <PageShell>
      {/* header */}
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-5 pt-10 pb-10 lg:pt-14">
          <nav className="font-mono text-xs text-faint" aria-label="Breadcrumb">
            <Link href="/dsa" className="hover:text-fg">DSA</Link> <span className="mx-1.5">/</span> {p.category}
          </nav>
          <div className="mt-6 flex items-start gap-5">
            <span className="hidden font-mono text-6xl font-semibold leading-none text-border-strong sm:block">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h1 className="display text-[clamp(2.25rem,6vw,4.25rem)]">{p.name}</h1>
              <p className="mt-3 max-w-2xl text-lg text-muted">{p.tagline}</p>
            </div>
          </div>
          <dl className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-3">
            <div className="bg-bg px-4 py-3">
              <dt className="eyebrow text-faint">Brute force</dt>
              <dd className="mt-1 font-mono text-sm text-weak">{p.complexity.brute}</dd>
            </div>
            <div className="bg-bg px-4 py-3">
              <dt className="eyebrow text-faint">With the pattern</dt>
              <dd className="mt-1 font-mono text-sm text-good">{p.complexity.pattern}</dd>
            </div>
            <div className="bg-bg px-4 py-3">
              <dt className="eyebrow text-faint">Extra space</dt>
              <dd className="mt-1 font-mono text-sm text-fg">{p.complexity.space}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* sticky section nav */}
      <div className="sticky top-14 z-30 border-b border-border bg-bg/90 backdrop-blur-md">
        <nav className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-5" aria-label="On this page">
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="inline-flex min-h-11 shrink-0 items-center px-2.5 font-mono text-xs text-muted transition-colors hover:text-fg">
              {label}
            </a>
          ))}
        </nav>
      </div>

      <div className="mx-auto w-full max-w-6xl px-5">
        {/* idea */}
        <section id="idea" className="scroll-mt-28 border-b border-border py-12">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 [&>*]:min-w-0">
            <div>
              <p className="eyebrow text-accent">In plain English</p>
              <blockquote className="serif-italic mt-4 text-2xl leading-snug text-fg sm:text-[1.7rem]">“{p.analogy}”</blockquote>
            </div>
            <div>
              <p className="eyebrow text-accent">Why it&apos;s fast</p>
              <p className="mt-4 text-[17px] leading-[1.75] text-fg/85">
                <Inline text={p.insight} />
              </p>
            </div>
          </div>
        </section>

        {/* cues */}
        <section id="spot-it" className="scroll-mt-28 border-b border-border py-12">
          <p className="eyebrow text-accent">Spot it when the problem says…</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {p.cues.map((c) => (
              <li key={c} className="border border-border-strong bg-surface px-3 py-2 text-sm text-fg">
                <Inline text={c} />
              </li>
            ))}
          </ul>
        </section>

        {/* visualizer */}
        <section id="visualize" className="scroll-mt-28 border-b border-border py-12">
          <Visualizer slug={p.slug} />
        </section>

        {/* steps */}
        <section id="apply" className="scroll-mt-28 border-b border-border py-12">
          <p className="eyebrow text-accent">How to apply it</p>
          <ol className="mt-6 grid gap-px border border-border bg-border md:grid-cols-2">
            {p.steps.map((s, k) => (
              <li key={k} className="flex gap-4 bg-bg p-5">
                <span className="font-mono text-sm text-accent">{String(k + 1).padStart(2, "0")}</span>
                <span className="text-[15px] leading-relaxed text-fg/85">
                  <Inline text={s} />
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* variations */}
        <section id="variations" className="scroll-mt-28 border-b border-border py-12">
          <p className="eyebrow text-accent">Variations you&apos;ll meet</p>
          <div className="mt-6 space-y-8">
            {p.variations.map((v) => (
              <div key={v.name} className="grid grid-cols-1 gap-4 lg:grid-cols-[0.8fr_1.2fr] [&>*]:min-w-0">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{v.name}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">
                    <Inline text={v.note} />
                  </p>
                </div>
                {v.code ? <CodeBlock code={v.code} lang="python" className="!my-0" /> : <div className="hidden lg:block" />}
              </div>
            ))}
          </div>
        </section>

        {/* mistakes */}
        <section id="mistakes" className="scroll-mt-28 border-b border-border py-12">
          <p className="eyebrow text-accent">Common mistakes</p>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {p.mistakes.map((m) => (
              <li key={m} className="border-l-2 border-weak bg-weak/5 px-4 py-3 text-[15px] leading-relaxed text-fg/85">
                <Inline text={m} />
              </li>
            ))}
          </ul>
        </section>

        {/* practice */}
        <section id="practice" className="scroll-mt-28 py-12">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-accent">Practice ladder</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Easy → hard. Tick them off as you go.</h2>
            </div>
          </div>
          <div className="mt-6">
            <ProblemList problems={p.problems} />
          </div>
          <div className="mt-8 flex flex-col items-start justify-between gap-4 border border-border bg-surface p-5 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold">Think you&apos;ve got it?</p>
              <p className="mt-1 text-sm text-muted">Let the AI interviewer throw a {p.name} problem at you and grade how you explain it.</p>
            </div>
            <Link
              href={`/interview?topic=${encodeURIComponent(`${p.name} (DSA pattern)`)}&difficulty=Medium&round=Technical`}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 bg-accent px-5 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-strong"
            >
              Mock interview <IconArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </div>

      {/* prev / next */}
      <nav className="border-t border-border" aria-label="Pattern navigation">
        <div className="mx-auto grid w-full max-w-6xl sm:grid-cols-2">
          {prev ? (
            <Link href={`/dsa/${prev.slug}`} className="group border-b border-border px-5 py-6 transition-colors hover:bg-surface sm:border-r sm:border-b-0">
              <span className="eyebrow text-faint">← Previous</span>
              <p className="mt-1 font-semibold group-hover:text-accent">{prev.name}</p>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/dsa/${next.slug}`} className="group px-5 py-6 text-right transition-colors hover:bg-surface">
              <span className="eyebrow text-faint">Next →</span>
              <p className="mt-1 font-semibold group-hover:text-accent">{next.name}</p>
            </Link>
          )}
        </div>
      </nav>
    </PageShell>
  );
}
