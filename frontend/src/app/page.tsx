import Link from "next/link";
import { ContinueBanner } from "@/components/ContinueBanner";
import { IconArrowRight, IconBriefcase, IconFile, IconLightbulb, IconTarget } from "@/components/icons";
import { Wordmark } from "@/components/ui";

const STEPS = [
  {
    n: "01",
    title: "Set the scene",
    body: "Name a topic, pick Easy, Medium or Hard, and optionally the round you're preparing for and your resume.",
  },
  {
    n: "02",
    title: "Answer, one question at a time",
    body: "The interviewer probes when you're close, notes the gap when you're wrong, and never teaches or hints — just like the real thing.",
  },
  {
    n: "03",
    title: "Get the verdict",
    body: "It ends the interview when a real interviewer would. Then you get a score, Pass or Fail, and evidence from what you actually said.",
  },
];

const FEATURES = [
  {
    icon: IconFile,
    title: "Resume-aware questions",
    body: "Upload your resume and the interviewer asks about your projects and claims — and checks their depth.",
  },
  {
    icon: IconBriefcase,
    title: "Six interview rounds",
    body: "Phone screen, technical, system design, behavioral, hiring manager or final — each changes what gets asked.",
  },
  {
    icon: IconTarget,
    title: "Ends when it should",
    body: "Struggling across several questions? It wraps up kindly. Doing well? It stops once the key areas are covered.",
  },
  {
    icon: IconLightbulb,
    title: "A report you can act on",
    body: "Strengths, weaknesses and topics to revise quote your own answers, plus concrete prep for the real interview.",
  },
];

const BANDS = [
  { range: "85+", label: "Excellent", tone: "text-good" },
  { range: "70", label: "Good", tone: "text-good" },
  { range: "55", label: "Adequate", tone: "text-okay" },
  { range: "<55", label: "Weak", tone: "text-weak" },
];

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5">
          <Wordmark />
          <nav className="flex items-center gap-5 text-sm">
            <a href="#how" className="hidden min-h-11 items-center text-muted transition-colors hover:text-fg sm:inline-flex">
              How it works
            </a>
            <Link href="/interview" className="underline-cta min-h-11">
              Start an interview <IconArrowRight className="size-4" />
            </Link>
          </nav>
        </div>
      </header>
      <ContinueBanner />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="ruled pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 pt-16 pb-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:pt-24 lg:pb-28">
            <div>
              <p className="eyebrow text-accent">Mock technical interviews · Pass or Fail</p>
              <h1 className="display mt-5 text-[clamp(2.75rem,9vw,6.5rem)]">
                Interview
                <br />
                like it&apos;s <span className="serif-italic text-accent">real.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
                An AI interviewer that asks one question at a time, tailors it to your resume, decides
                when you&apos;re done, and grades you honestly.
              </p>
              <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
                <Link
                  href="/interview"
                  className="inline-flex min-h-13 items-center justify-center gap-2 bg-accent px-7 text-base font-semibold text-accent-fg transition-colors duration-200 hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                >
                  Start an interview <IconArrowRight className="size-4" />
                </Link>
                <a href="#how" className="underline-cta self-start text-base sm:self-auto">
                  See how it works
                </a>
              </div>
            </div>

            {/* Transcript preview */}
            <aside aria-label="Example of an interview turn" className="border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="eyebrow text-muted">Transcript · Q3</span>
                <span className="eyebrow text-okay">Medium · System design</span>
              </div>
              <div className="space-y-4 px-4 py-5 text-[15px] leading-relaxed">
                <p>
                  <span className="eyebrow mr-2 text-accent">Interviewer</span>
                  On your resume you mention cutting p95 latency by 40% with Redis. How did you decide what
                  to cache, and how did you keep it consistent on writes?
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

        {/* How it works */}
        <section id="how" className="border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-24">
            <p className="eyebrow text-accent">How it works</p>
            <h2 className="display mt-4 text-3xl sm:text-5xl">Three steps. No fluff.</h2>
            <ol className="mt-12 grid gap-px border border-border bg-border sm:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="bg-bg p-6 sm:p-8">
                  <span className="font-mono text-4xl font-semibold text-border-strong">{s.n}</span>
                  <h3 className="mt-6 text-xl font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section className="border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="eyebrow text-accent">What makes it different</p>
                <h2 className="display mt-4 text-3xl sm:text-5xl">
                  It behaves like an interviewer, <span className="serif-italic text-muted">not a tutor.</span>
                </h2>
              </div>
              <ul className="grid gap-px border border-border bg-border sm:grid-cols-2">
                {FEATURES.map((f) => (
                  <li key={f.title} className="bg-bg p-6">
                    <f.icon className="size-5 text-accent" />
                    <h3 className="mt-4 text-lg font-semibold tracking-tight">{f.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Scoring */}
        <section className="border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 lg:py-24">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow text-accent">Scoring</p>
                <h2 className="display mt-4 text-3xl sm:text-5xl">Honest by design.</h2>
              </div>
              <p className="max-w-md text-[15px] leading-relaxed text-muted">
                Every score is out of 100 and graded against the difficulty you chose. 55 and above is a
                Pass. Strengths and weaknesses must quote what you actually said.
              </p>
            </div>
            <dl className="mt-12 grid grid-cols-2 gap-px border border-border bg-border lg:grid-cols-4">
              {BANDS.map((b) => (
                <div key={b.label} className="bg-bg p-6">
                  <dt className={`font-mono text-4xl font-semibold tabular-nums sm:text-5xl ${b.tone}`}>{b.range}</dt>
                  <dd className="mt-2 text-sm text-muted">{b.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Final CTA */}
        <section>
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-5 py-20 lg:flex-row lg:items-center lg:justify-between lg:py-28">
            <h2 className="display text-[clamp(2.25rem,7vw,5rem)]">
              Ready when <span className="serif-italic text-accent">you</span> are.
            </h2>
            <Link
              href="/interview"
              className="inline-flex min-h-13 items-center justify-center gap-2 bg-accent px-7 text-base font-semibold text-accent-fg transition-colors duration-200 hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Start an interview <IconArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <span>AI Interview Coach — practice, then pass.</span>
          <span className="font-mono">Nothing is stored. Your resume stays in this browser tab.</span>
        </div>
      </footer>
    </div>
  );
}
