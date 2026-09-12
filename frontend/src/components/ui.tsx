import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Difficulty, Round } from "@/lib/types";
import { IconAlert } from "@/components/icons";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primary = the single solid accent action per screen; outline/ghost are subordinate. */
  variant?: "primary" | "outline" | "ghost";
  loading?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex min-h-12 items-center justify-center gap-2 px-5 text-sm font-semibold tracking-tight transition-[background-color,border-color,color] duration-200 ease-out " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-bg " +
    "disabled:cursor-not-allowed disabled:opacity-40";
  const styles = {
    primary: "bg-accent text-accent-fg hover:bg-accent-strong",
    outline: "border border-border-strong text-fg hover:border-fg hover:bg-surface-2",
    ghost: "text-muted hover:bg-surface-2 hover:text-fg",
  }[variant];
  return (
    <button className={`${base} ${styles} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function ErrorBanner({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 border-l-2 border-weak bg-weak/10 px-4 py-3 text-sm text-fg sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2.5">
        <IconAlert className="mt-0.5 size-4 shrink-0 text-weak" />
        <span>{message}</span>
      </div>
      {action}
    </div>
  );
}

export function Tag({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: "neutral" | "good" | "okay" | "weak" | "accent";
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    neutral: "text-muted border-border-strong",
    good: "text-good border-good/40",
    okay: "text-okay border-okay/40",
    weak: "text-weak border-weak/40",
    accent: "text-accent border-accent/50",
  }[tone];
  return (
    <span className={`eyebrow inline-flex items-center gap-1 border px-1.5 py-0.5 ${styles} ${className}`}>
      {children}
    </span>
  );
}

export function DifficultyTag({ difficulty }: { difficulty: Difficulty }) {
  const tone = { Easy: "good", Medium: "okay", Hard: "weak" }[difficulty] as "good" | "okay" | "weak";
  return <Tag tone={tone}>{difficulty}</Tag>;
}

export function RoundTag({ round }: { round: Round | null }) {
  if (!round) return null;
  return <Tag tone="accent">{round}</Tag>;
}

export function Wordmark({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link
      href={href}
      aria-label="AI Interview Coach — home"
      className="eyebrow inline-flex min-h-11 items-center gap-2 whitespace-nowrap text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
    >
      <span className="inline-block size-2 bg-accent" aria-hidden="true" />
      <span className={compact ? "hidden sm:inline" : undefined}>AI Interview Coach</span>
    </Link>
  );
}

export function Field({
  id,
  label,
  hint,
  optional = false,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor={id} className="eyebrow text-muted">
          {label}
        </label>
        {optional && <span className="font-mono text-[11px] text-faint">optional</span>}
      </div>
      {children}
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-faint">{hint}</p>}
    </div>
  );
}

export const inputClass =
  "w-full min-h-12 border border-border-strong bg-surface-2 px-3.5 py-3 text-base text-fg placeholder:text-faint transition-colors duration-200 hover:border-faint focus:border-fg focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";
