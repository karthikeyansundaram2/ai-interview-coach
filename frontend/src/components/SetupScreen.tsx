"use client";

import { useEffect, useState, type FormEvent } from "react";
import { IconArrowRight, IconChevron } from "@/components/icons";
import { ResumeUpload } from "@/components/ResumeUpload";
import { Button, ErrorBanner, Field, Wordmark, inputClass } from "@/components/ui";
import { ApiError, startInterview } from "@/lib/api";
import {
  DIFFICULTIES,
  ROUNDS,
  type Difficulty,
  type InterviewContext,
  type InterviewSession,
  type Resume,
  type Round,
} from "@/lib/types";

const DIFFICULTY_HINT: Record<Difficulty, string> = {
  Easy: "Definitions & recall",
  Medium: "Applied problems",
  Hard: "Trade-offs & systems",
};

const SUGGESTIONS = ["React hooks", "SQL indexing", "REST API design", "Python decorators", "Caching"];

export function SetupScreen({ onStart }: { onStart: (session: InterviewSession) => void }) {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [round, setRound] = useState<Round | "">("");
  const [targetRole, setTargetRole] = useState("");
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false); // free-tier backends sleep; the first request can take ~1 min
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setSlow(true), 6000);
    return () => {
      clearTimeout(t);
      setSlow(false);
    };
  }, [loading]);

  const resumeDriven = Boolean(resume) && !topic.trim();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed && !resume) {
      setError("Enter a topic — or upload your resume and let it drive the interview.");
      document.getElementById("topic")?.focus();
      return;
    }
    if (trimmed && trimmed.length < 2) return setError("The topic is too short — try something like “React hooks”.");
    if (!difficulty) return setError("Pick a difficulty level.");

    const context: InterviewContext = {
      round: round || null,
      target_role: targetRole.trim() || null,
      resume_text: resume?.text ?? null,
      resume_filename: resume?.filename ?? null,
    };

    setError(null);
    setLoading(true);
    try {
      const res = await startInterview(trimmed, difficulty, context);
      onStart({
        topic: trimmed,
        difficulty,
        context,
        messages: [{ role: "interviewer", content: res.message }],
        over: false,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5">
          <Wordmark />
          <span className="eyebrow text-faint">Set up</span>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-16">
        <div className="lg:sticky lg:top-10 lg:self-start">
          <p className="eyebrow text-accent">New interview</p>
          <h1 className="display mt-4 text-4xl sm:text-5xl">
            Set the <span className="serif-italic text-muted">scene.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted sm:text-base">
            Name a topic and a level. Or upload your resume, choose the round, and the interviewer will
            run it the way a real one would — across the technologies and projects you actually list.
          </p>
          <dl className="mt-8 hidden gap-4 border-t border-border pt-6 text-sm lg:grid">
            <div className="flex gap-4">
              <dt className="eyebrow w-24 shrink-0 pt-0.5 text-faint">Length</dt>
              <dd className="text-muted">3–8 questions. The interviewer decides when it ends.</dd>
            </div>
            <div className="flex gap-4">
              <dt className="eyebrow w-24 shrink-0 pt-0.5 text-faint">Privacy</dt>
              <dd className="text-muted">Nothing is stored. Your resume stays in this browser tab.</dd>
            </div>
          </dl>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-8 border border-border bg-surface p-5 sm:p-8">
          {/* 1. Resume & round */}
          <section className="space-y-5">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-sm text-accent">01</span>
              <h2 className="text-lg font-semibold tracking-tight">Who&apos;s interviewing</h2>
            </div>
            <Field
              id="resume-upload"
              label="Resume"
              optional={!resumeDriven}
              hint="PDF, Word or text. With a resume attached you can leave the topic blank."
            >
              <ResumeUpload resume={resume} onChange={setResume} disabled={loading} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="round" label="Interview round" optional>
                <div className="relative">
                  <select
                    id="round"
                    value={round}
                    disabled={loading}
                    onChange={(e) => setRound(e.target.value as Round | "")}
                    className={`${inputClass} appearance-none pr-10`}
                  >
                    <option value="">Not specified</option>
                    {ROUNDS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <IconChevron className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted" />
                </div>
              </Field>
              <Field id="target-role" label="Target role" optional>
                <input
                  id="target-role"
                  type="text"
                  autoComplete="organization-title"
                  maxLength={120}
                  value={targetRole}
                  disabled={loading}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Senior Backend Engineer"
                  className={inputClass}
                />
              </Field>
            </div>
          </section>

          {/* 2. Topic & level */}
          <section className="space-y-5 border-t border-border pt-8">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-sm text-accent">02</span>
              <h2 className="text-lg font-semibold tracking-tight">What to cover</h2>
            </div>
            <Field
              id="topic"
              label="Topic"
              optional={Boolean(resume)}
              hint={
                resume
                  ? resumeDriven
                    ? "Leave blank to let your resume and round drive the interview."
                    : "The interview will focus on this topic, using your resume for context."
                  : undefined
              }
            >
              <input
                id="topic"
                name="topic"
                type="text"
                autoComplete="off"
                maxLength={120}
                value={topic}
                disabled={loading}
                onChange={(e) => {
                  setTopic(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={resume ? "Optional — e.g. Kubernetes networking" : "e.g. React hooks, SQL indexing, Kubernetes networking"}
                className={inputClass}
              />
              <div className="mt-2.5 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setTopic(s);
                      setError(null);
                    }}
                    className="min-h-9 border border-border px-3 font-mono text-xs text-muted transition-colors duration-200 hover:border-fg hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg disabled:opacity-40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>

            <fieldset disabled={loading}>
              <legend className="eyebrow mb-2 text-muted">Level</legend>
              <div className="grid grid-cols-3 gap-px border border-border bg-border">
                {DIFFICULTIES.map((d) => {
                  const active = difficulty === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setDifficulty(d);
                        if (error) setError(null);
                      }}
                      className={`min-h-14 px-3 py-3 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fg disabled:opacity-50 ${
                        active ? "bg-fg text-bg" : "bg-surface-2 text-muted hover:bg-surface-3 hover:text-fg"
                      }`}
                    >
                      <div className="text-sm font-semibold">{d}</div>
                      <div className={`mt-0.5 hidden text-xs sm:block ${active ? "text-bg/70" : "text-faint"}`}>
                        {DIFFICULTY_HINT[d]}
                      </div>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </section>

          {error && <ErrorBanner message={error} />}

          <Button type="submit" loading={loading} className="w-full text-base">
            {loading ? "Preparing your interviewer…" : "Start Interview"}
            {!loading && <IconArrowRight className="size-4" />}
          </Button>
          {loading && slow && (
            <p className="animate-fade-up text-center font-mono text-xs text-faint" role="status">
              Waking up the server — the first request after a while can take up to a minute.
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
