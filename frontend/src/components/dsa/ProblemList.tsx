"use client";

import { useState } from "react";
import { toggleProgress, useProgress } from "@/lib/progress";
import type { PatternProblem } from "@/lib/dsa/content-types";

const LEVEL: Record<string, string> = { Easy: "text-good border-good/40", Medium: "text-okay border-okay/40", Hard: "text-weak border-weak/40" };

export function Check({ id, label }: { id: string; label: string }) {
  const done = useProgress().has(id);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      onClick={() => toggleProgress(id)}
      className={`flex size-6 shrink-0 items-center justify-center border transition-colors ${done ? "border-good bg-good text-bg" : "border-border-strong hover:border-fg"}`}
    >
      {done && (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
          <path d="M5 12l5 5L20 7" />
        </svg>
      )}
    </button>
  );
}

export function ProblemList({ problems }: { problems: PatternProblem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const progress = useProgress();
  const solved = problems.filter((p) => progress.has(`dsa:${p.lc}`)).length;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-xs text-muted">
          {solved}/{problems.length} solved
        </span>
        <div className="h-1 w-40 bg-surface-3">
          <div className="h-1 bg-good transition-[width] duration-300" style={{ width: `${(solved / Math.max(1, problems.length)) * 100}%` }} />
        </div>
      </div>
      <ol className="divide-y divide-border border border-border">
        {problems.map((p, i) => (
          <li key={p.lc} className="bg-bg">
            <div className="flex items-center gap-3 px-4 py-3">
              <Check id={`dsa:${p.lc}`} label={`Mark ${p.title} solved`} />
              <span className="w-6 font-mono text-xs text-faint">{String(i + 1).padStart(2, "0")}</span>
              <a
                href={`https://leetcode.com/problems/${p.lc}/`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate font-medium text-fg hover:text-accent"
              >
                {p.title} <span className="text-faint">↗</span>
              </a>
              <span className={`eyebrow border px-1.5 py-0.5 ${LEVEL[p.level]}`}>{p.level}</span>
              <button
                type="button"
                onClick={() => setOpen(open === p.lc ? null : p.lc)}
                className="hidden min-h-8 px-2 font-mono text-xs text-muted hover:text-fg sm:inline"
                aria-expanded={open === p.lc}
              >
                {open === p.lc ? "hide hint" : "hint"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setOpen(open === p.lc ? null : p.lc)}
              className="block w-full px-4 pb-2 text-left font-mono text-[11px] text-faint sm:hidden"
            >
              {open === p.lc ? "hide hint" : "show hint"}
            </button>
            {open === p.lc && (
              <div className="border-t border-border bg-surface px-4 py-3 pl-[4.25rem] text-sm text-muted">
                <p>
                  <span className="eyebrow mr-2 text-accent">Hint</span>
                  {p.hint}
                </p>
                {p.companies && p.companies.length > 0 && <p className="mt-2 font-mono text-[11px] text-faint">Asked at: {p.companies.join(" · ")}</p>}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PatternProgress({ ids }: { ids: string[] }) {
  const progress = useProgress();
  const n = ids.filter((id) => progress.has(id)).length;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 flex-1 bg-surface-3">
        <div className="h-1 bg-good transition-[width] duration-300" style={{ width: `${(n / Math.max(1, ids.length)) * 100}%` }} />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-faint">
        {n}/{ids.length}
      </span>
    </div>
  );
}
