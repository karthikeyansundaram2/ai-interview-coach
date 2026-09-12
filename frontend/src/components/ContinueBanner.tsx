"use client";

import Link from "next/link";
import { useAppState, useHydrated } from "@/lib/store";
import { IconArrowRight } from "@/components/icons";

/** Shown on the homepage when an interview is in progress in this tab. */
export function ContinueBanner() {
  const hydrated = useHydrated();
  const state = useAppState();
  if (!hydrated || state.stage === "setup" || !state.session) return null;

  const label = state.stage === "report" ? "View your report" : "Continue your interview";
  return (
    <div className="animate-fade-up border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-2.5">
        <p className="text-sm text-muted">
          <span className="font-mono text-xs uppercase tracking-wider text-accent">In progress</span>
          <span className="mx-2 text-border-strong">/</span>
          {state.session.topic}
        </p>
        <Link href="/interview" className="underline-cta text-sm">
          {label} <IconArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
