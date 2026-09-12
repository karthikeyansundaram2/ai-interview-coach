"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { IconCode, IconFile, IconSend } from "@/components/icons";
import { MessageContent } from "@/components/MessageContent";
import {
  Button,
  DifficultyTag,
  ErrorBanner,
  RoundTag,
  Spinner,
  Wordmark,
} from "@/components/ui";
import { ApiError, submitAnswer } from "@/lib/api";
import { sessionTitle, type InterviewSession, type Message } from "@/lib/types";

const END_DELAY_MS = 1400; // let the user read the closing message before the report appears

const LANGUAGES = [
  "python",
  "javascript",
  "typescript",
  "java",
  "go",
  "c++",
  "c#",
  "rust",
  "sql",
  "other",
];

interface Props {
  session: InterviewSession;
  onUpdate: (session: InterviewSession) => void;
  onFinished: () => void;
  onAbort: () => void;
}

export function InterviewScreen({
  session,
  onUpdate,
  onFinished,
  onAbort,
}: Props) {
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [codeMode, setCodeMode] = useState(false);
  const [language, setLanguage] = useState("python");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const questionsAsked = session.messages.filter(
    (m) => m.role === "interviewer",
  ).length;
  const answered = session.messages.some((m) => m.role === "candidate");

  // Nudge towards Code mode when the interviewer has asked for code.
  const lastInterviewer = [...session.messages]
    .reverse()
    .find((m) => m.role === "interviewer");
  const wantsCode = Boolean(
    lastInterviewer &&
    /write the code|implement|```/i.test(lastInterviewer.content),
  );
  const showCodeNudge = wantsCode && !codeMode && !session.over && !thinking;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [session.messages.length, thinking, error]);

  useEffect(() => {
    if (!thinking && !session.over)
      inputRef.current?.focus({ preventScroll: true });
  }, [thinking, session.over]);

  // Grow the textarea with its content (up to a cap) and shrink back when cleared.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, codeMode ? 320 : 160) + "px";
  }, [draft, codeMode]);

  useEffect(() => {
    if (!session.over) return;
    const t = setTimeout(onFinished, END_DELAY_MS);
    return () => clearTimeout(t);
  }, [session.over, onFinished]);

  // The "End" button asks for a second click; the request expires after a few seconds.
  useEffect(() => {
    if (!confirmEnd) return;
    const t = setTimeout(() => setConfirmEnd(false), 6000);
    return () => clearTimeout(t);
  }, [confirmEnd]);

  function handleEnd() {
    if (!confirmEnd) return setConfirmEnd(true);
    // Grade what has been answered so far; if nothing was answered there is nothing to grade.
    if (answered) onFinished();
    else onAbort();
  }

  async function send() {
    const raw = draft.replace(/\s+$/, "");
    if (!raw.trim() || thinking || session.over) return;
    // In code mode the answer is sent as a fenced block so the interviewer grades it as code.
    const lang = language === "other" ? "" : language;
    const answer = codeMode ? `\`\`\`${lang}\n${raw}\n\`\`\`` : raw.trim();

    setError(null);
    setThinking(true);
    const withAnswer: Message[] = [
      ...session.messages,
      { role: "candidate", content: answer },
    ];
    onUpdate({ ...session, messages: withAnswer });
    setDraft("");

    try {
      const res = await submitAnswer(
        session.topic,
        session.difficulty,
        session.messages,
        answer,
        session.context,
      );
      onUpdate({
        ...session,
        messages: [
          ...withAnswer,
          { role: "interviewer", content: res.message },
        ],
        over: res.interview_over,
      });
    } catch (err) {
      // Roll back so the user can retry the same answer.
      onUpdate({ ...session, messages: session.messages });
      setDraft(answer);
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setThinking(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void send();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return;
    if (codeMode) {
      // Code mode: Enter = newline, Tab = indent, ⌘/Ctrl+Enter = send.
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void send();
      } else if (e.key === "Tab") {
        e.preventDefault();
        const el = e.currentTarget;
        const { selectionStart, selectionEnd, value } = el;
        const next =
          value.slice(0, selectionStart) + "  " + value.slice(selectionEnd);
        setDraft(next);
        requestAnimationFrame(() =>
          el.setSelectionRange(selectionStart + 2, selectionStart + 2),
        );
      }
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const disabled = thinking || session.over;

  return (
    // Fixed-height shell: header / scrolling transcript / pinned composer.
    // `min-h-0` on the transcript is what lets it scroll instead of pushing the composer off-screen.
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border bg-bg">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Wordmark compact />
            <div
              className="hidden h-6 w-px bg-border sm:block"
              aria-hidden="true"
            />
            <div className="min-w-0 py-2">
              <div className="truncate text-sm font-semibold tracking-tight">
                {sessionTitle(session)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <DifficultyTag difficulty={session.difficulty} />
                <RoundTag round={session.context.round} />
                {session.context.resume_filename && (
                  <span
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-faint"
                    title={`Using resume: ${session.context.resume_filename}`}
                  >
                    <IconFile className="size-3.5" />
                    <span className="hidden sm:inline">resume</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="eyebrow hidden text-faint sm:inline">
              Q<span className="text-fg">{questionsAsked}</span>
            </span>
            <Button
              variant={confirmEnd ? "outline" : "ghost"}
              onClick={handleEnd}
              disabled={thinking || session.over}
              className="min-h-10 px-3 text-xs"
            >
              {confirmEnd
                ? answered
                  ? "Confirm: end & grade"
                  : "Confirm: leave"
                : "End"}
            </Button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
          {session.messages.map((m, i) => (
            <Turn key={i} message={m} index={i} />
          ))}

          {thinking && (
            <div className="animate-fade-up">
              <span className="eyebrow text-accent">Interviewer</span>
              <div
                className="mt-1.5 flex items-center gap-1.5"
                aria-label="Interviewer is thinking"
                role="status"
              >
                <span className="thinking-dot size-1.5 bg-muted" />
                <span className="thinking-dot size-1.5 bg-muted" />
                <span className="thinking-dot size-1.5 bg-muted" />
              </div>
            </div>
          )}

          {session.over && (
            <div
              className="animate-fade-up flex items-center gap-2 border-t border-border pt-5 text-sm text-muted"
              role="status"
            >
              <Spinner className="size-4 text-accent" />
              Interview complete — preparing your report…
            </div>
          )}

          {error && (
            <ErrorBanner
              message={error}
              action={
                <Button
                  variant="outline"
                  onClick={() => void send()}
                  className="min-h-10 px-3 text-xs"
                >
                  Retry
                </Button>
              }
            />
          )}
          <div ref={bottomRef} className="h-px" />
        </div>
      </main>

      <footer className="shrink-0 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)]">
        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full max-w-3xl px-4 py-3"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div
                className="flex items-center gap-1"
                role="group"
                aria-label="Answer mode"
              >
                <ModeButton
                  active={!codeMode}
                  onClick={() => setCodeMode(false)}
                  disabled={disabled}
                >
                  Text
                </ModeButton>
                <ModeButton
                  active={codeMode}
                  onClick={() => setCodeMode(true)}
                  disabled={disabled}
                >
                  <IconCode className="size-3.5" /> Code
                </ModeButton>
              </div>
              {showCodeNudge && (
                <button
                  type="button"
                  onClick={() => setCodeMode(true)}
                  className="animate-fade-up font-mono text-[11px] text-accent underline-offset-2 hover:underline"
                >
                  This question wants code — switch to Code mode →
                </button>
              )}
            </div>
            {codeMode && (
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={disabled}
                aria-label="Code language"
                className="min-h-9 border border-border bg-surface-2 px-2 font-mono text-xs text-muted focus:border-fg focus:outline-none"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div
            className={`flex items-end gap-2 border bg-surface transition-colors duration-200 ${
              disabled
                ? "border-border opacity-60"
                : "border-border-strong focus-within:border-fg"
            }`}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              disabled={disabled}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={!codeMode}
              wrap={codeMode ? "off" : undefined}
              autoCapitalize={codeMode ? "off" : undefined}
              autoCorrect={codeMode ? "off" : undefined}
              placeholder={
                session.over
                  ? "The interview has ended."
                  : thinking
                    ? "Interviewer is thinking…"
                    : codeMode
                      ? "Write or paste your code…"
                      : "Type your answer…"
              }
              aria-label={codeMode ? "Your code answer" : "Your answer"}
              className={`flex-1 resize-none bg-transparent px-3.5 py-3 leading-relaxed text-fg placeholder:text-faint focus:outline-none disabled:cursor-not-allowed ${
                codeMode
                  ? "max-h-80 min-h-32 overflow-x-auto font-mono text-[13px] whitespace-pre sm:text-sm"
                  : "max-h-40 min-h-12 text-base"
              }`}
            />
            <Button
              type="submit"
              disabled={disabled || !draft.trim()}
              className="m-1.5 size-9 min-h-9 px-0 sm:size-10 sm:min-h-10"
              aria-label="Send answer"
            >
              <IconSend className="size-4" />
            </Button>
          </div>
          <p className="mt-2 hidden font-mono text-[11px] text-faint sm:block">
            {codeMode
              ? "⌘/Ctrl+Enter to send · Tab to indent"
              : "Enter to send · Shift+Enter for a new line"}
          </p>
        </form>
      </footer>
    </div>
  );
}

function Turn({ message, index }: { message: Message; index: number }) {
  const mine = message.role === "candidate";
  return (
    <div
      className={`animate-fade-up ${mine ? "pl-6 sm:pl-16" : "pr-6 sm:pr-16"}`}
    >
      <div className="flex items-baseline justify-between">
        <span className={`eyebrow ${mine ? "text-faint" : "text-accent"}`}>
          {mine ? "You" : "Interviewer"}
        </span>
        <span className="font-mono text-[11px] text-border-strong">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <MessageContent
        text={message.content}
        className={`mt-1.5 text-[15px] leading-relaxed sm:text-base ${
          mine ? "border-l-2 border-border-strong pl-3.5 text-muted" : "text-fg"
        }`}
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex min-h-9 items-center gap-1.5 border px-3 font-mono text-xs transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg disabled:opacity-40 ${
        active
          ? "border-fg bg-fg text-bg"
          : "border-border text-muted hover:border-border-strong hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
