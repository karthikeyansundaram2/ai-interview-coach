"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { IconArrowRight, IconFile, IconRefresh } from "@/components/icons";
import { Button, DifficultyTag, ErrorBanner, RoundTag, Spinner, Wordmark } from "@/components/ui";
import { ApiError, generateReport } from "@/lib/api";
import { sessionTitle, type Band, type InterviewSession, type Report } from "@/lib/types";

interface Props {
  session: InterviewSession;
  onRestart: () => void;
}

const BAND_LABEL: Record<Band, string> = {
  excellent: "Excellent",
  good: "Good",
  adequate: "Adequate",
  weak: "Weak",
};

function toneFor(band: Band) {
  if (band === "excellent" || band === "good") return "text-good";
  if (band === "adequate") return "text-okay";
  return "text-weak";
}

export function ReportScreen({ session, onRestart }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    generateReport(session.topic, session.difficulty, session.messages, session.context)
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, attempt]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  const questionCount = session.messages.filter((m) => m.role === "interviewer").length;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-5">
          <Wordmark />
          <Button variant="ghost" onClick={onRestart} className="min-h-10 px-3 text-xs">
            New interview
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 py-10 lg:py-14">
        <div className="animate-fade-up border-b border-border pb-8">
          <p className="eyebrow text-accent">Interview complete</p>
          <h1 className="display mt-4 text-3xl sm:text-5xl">{sessionTitle(session)}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <DifficultyTag difficulty={session.difficulty} />
            <RoundTag round={session.context.round} />
            {session.context.resume_filename && (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-faint" title={session.context.resume_filename}>
                <IconFile className="size-3.5" /> resume used
              </span>
            )}
            <span className="font-mono text-[11px] text-faint">· {questionCount} questions</span>
          </div>
        </div>

        {loading && <ReportSkeleton />}

        {!loading && error && (
          <div className="mt-8">
            <ErrorBanner
              message={error}
              action={
                <Button variant="outline" onClick={retry} className="min-h-10 px-3 text-xs">
                  <IconRefresh className="size-3.5" /> Retry
                </Button>
              }
            />
          </div>
        )}

        {!loading && report && <ReportBody report={report} session={session} onRestart={onRestart} />}
      </main>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="animate-fade-up mt-8 space-y-px" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3 border border-border px-6 py-10">
        <Spinner className="size-5 text-accent" />
        <p className="text-sm text-muted">Grading your answers…</p>
      </div>
      <div className="h-32 animate-pulse border border-border bg-surface" />
      <div className="h-32 animate-pulse border border-border bg-surface" />
    </div>
  );
}

function ReportBody({
  report,
  session,
  onRestart,
}: {
  report: Report;
  session: InterviewSession;
  onRestart: () => void;
}) {
  const tone = toneFor(report.band);
  const passed = report.result === "Pass";
  const personalised = Boolean(session.context.round || session.context.resume_text || session.context.target_role);

  return (
    <div className="mt-8">
      {/* Scorecard */}
      <div className="animate-score-in grid gap-px border border-border bg-border sm:grid-cols-[auto_1fr]">
        <div className="bg-bg p-6 sm:min-w-56 sm:p-8">
          <span className="eyebrow text-muted">Score</span>
          <div
            className={`mt-2 font-mono text-[5.5rem] leading-none font-semibold tabular-nums tracking-tighter sm:text-[7rem] ${tone}`}
            role="img"
            aria-label={`Score ${report.score} out of 100, ${BAND_LABEL[report.band]}`}
          >
            {report.score}
          </div>
          <div className="mt-1 font-mono text-sm text-faint">
            / 100 · <span className={tone}>{BAND_LABEL[report.band]}</span>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-6 bg-bg p-6 sm:p-8">
          <div>
            <span className="eyebrow text-muted">Result</span>
            <div
              className={`display mt-2 text-[clamp(3rem,10vw,5.5rem)] uppercase ${passed ? "text-good" : "text-weak"}`}
            >
              {report.result}
            </div>
          </div>
          <p className="max-w-md text-[15px] leading-relaxed text-muted">
            {passed
              ? "You cleared the bar for this level. The notes below show what to sharpen next."
              : "Not quite there this time. The notes below show exactly where to focus."}
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="mt-px grid gap-px border border-border border-t-0 bg-border sm:grid-cols-2">
        <Section n="01" title="Strengths" tone="text-good" delay={80}>
          <BulletList items={report.strengths} empty="No clear strengths were identified." />
        </Section>
        <Section n="02" title="Areas for improvement" tone="text-weak" delay={120}>
          <BulletList items={report.weaknesses} empty="No specific weaknesses were identified." />
        </Section>
        <Section n="03" title="Topics to revise" tone="text-okay" delay={160}>
          {report.topics_to_revise.length ? (
            <ul className="flex flex-wrap gap-2">
              {report.topics_to_revise.map((t, i) => (
                <li key={i} className="border border-border-strong px-2.5 py-1.5 text-sm">
                  {t}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing specific — keep practising broadly.</p>
          )}
        </Section>
        <Section
          n="04"
          title={personalised ? "How to prepare for the real thing" : "Preparation tips"}
          tone="text-accent"
          delay={200}
        >
          {report.preparation_tips.length ? (
            <ol className="space-y-3">
              {report.preparation_tips.map((tip, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed">
                  <span className="font-mono text-xs leading-6 text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">Keep practising — try a harder level next time.</p>
          )}
        </Section>
      </div>

      {/* Verdict as a pull quote */}
      <blockquote
        className="animate-fade-up mt-px border border-border border-t-0 px-6 py-10 sm:px-10 sm:py-14"
        style={{ animationDelay: "240ms" }}
      >
        <p className="eyebrow text-muted">Interviewer&apos;s verdict</p>
        <p className="serif-italic mt-4 max-w-2xl text-2xl leading-snug text-fg sm:text-3xl">
          &ldquo;{report.verdict}&rdquo;
        </p>
      </blockquote>

      <div className="animate-fade-up mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" style={{ animationDelay: "280ms" }}>
        <p className="text-sm text-muted">Ready to go again? Pick a harder level or a different round.</p>
        <Button onClick={onRestart} className="text-base">
          Start New Interview <IconArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Section({
  n,
  title,
  tone,
  delay,
  children,
}: {
  n: string;
  title: string;
  tone: string;
  delay: number;
  children: ReactNode;
}) {
  return (
    <section className="animate-fade-up bg-bg p-6 sm:p-8" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-4 flex items-baseline gap-3">
        <span className={`font-mono text-sm ${tone}`}>{n}</span>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="border-l-2 border-border-strong pl-3.5 text-[15px] leading-relaxed">
          {item}
        </li>
      ))}
    </ul>
  );
}
