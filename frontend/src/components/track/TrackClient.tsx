"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { toggleProgress, useProgress } from "@/lib/progress";

export function ProgressCount({ ids, label }: { ids: string[]; label: string }) {
  const p = useProgress();
  const n = ids.filter((id) => p.has(id)).length;
  return (
    <div className="flex items-center gap-3">
      <div className="h-1 w-32 bg-surface-3">
        <div className="h-1 bg-good transition-[width] duration-300" style={{ width: `${(n / Math.max(1, ids.length)) * 100}%` }} />
      </div>
      <span className="font-mono text-xs tabular-nums text-muted">
        {n}/{ids.length} {label}
      </span>
    </div>
  );
}

export function ContinueLink({ items, fallbackLabel }: { items: { id: string; href: string; title: string }[]; fallbackLabel: string }) {
  const p = useProgress();
  const next = items.find((i) => !p.has(i.id));
  const started = items.some((i) => p.has(i.id));
  if (!next) return <span className="font-mono text-sm text-good">Track complete ✓</span>;
  return (
    <Link href={next.href} className="inline-flex min-h-12 items-center gap-2 bg-accent px-6 font-semibold text-accent-fg transition-colors hover:bg-accent-strong">
      {started ? `Continue: ${next.title}` : fallbackLabel} <span aria-hidden="true">→</span>
    </Link>
  );
}

export function DoneDot({ id }: { id: string }) {
  const done = useProgress().has(id);
  return (
    <span
      className={`flex size-5 shrink-0 items-center justify-center border text-[10px] ${done ? "border-good bg-good text-bg" : "border-border-strong text-transparent"}`}
      aria-label={done ? "completed" : "not completed"}
    >
      ✓
    </span>
  );
}

export function MarkComplete({ id, nextHref }: { id: string; nextHref?: string }) {
  const done = useProgress().has(id);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => toggleProgress(id)}
        className={`inline-flex min-h-12 items-center gap-2 px-6 text-sm font-semibold transition-colors ${done ? "border border-good text-good hover:bg-good/10" : "bg-fg text-bg hover:opacity-90"}`}
      >
        {done ? "✓ Completed" : "Mark as complete"}
      </button>
      {nextHref && !done && (
        <Link href={nextHref} onClick={() => toggleProgress(id, true)} className="underline-cta text-sm">
          Complete &amp; continue
        </Link>
      )}
    </div>
  );
}

export function Reveal({ children, minutes }: { children: ReactNode; minutes: number }) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(minutes * 60);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((s) => (s <= 1 ? (setRunning(false), 0) : s - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  if (open) return <>{children}</>;
  return (
    <div className="my-10 border border-dashed border-border-strong bg-surface p-6 text-center">
      <p className="eyebrow text-accent">Try it first</p>
      <p className="mx-auto mt-3 max-w-md text-muted">
        Set a timer, sketch your own design on paper, then compare it with the reference walkthrough.
      </p>
      <p className={`mt-5 font-mono text-5xl font-semibold tabular-nums ${left === 0 ? "text-good" : "text-fg"}`}>
        {mm}:{ss}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => setRunning((r) => !r)} className="min-h-11 border border-border-strong px-5 text-sm font-semibold hover:border-fg">
          {running ? "Pause timer" : left === minutes * 60 ? `Start ${minutes}-min timer` : "Resume timer"}
        </button>
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 bg-accent px-5 text-sm font-semibold text-accent-fg hover:bg-accent-strong">
          Reveal reference solution
        </button>
      </div>
    </div>
  );
}
