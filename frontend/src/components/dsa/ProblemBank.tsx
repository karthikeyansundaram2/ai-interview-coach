"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check } from "@/components/dsa/ProblemList";
import { useProgress } from "@/lib/progress";
import type { PatternProblem } from "@/lib/dsa/content-types";

type Row = PatternProblem & { pattern: string; patternSlug: string };
const LEVELS = ["All", "Easy", "Medium", "Hard"] as const;
const LEVEL: Record<string, string> = { Easy: "text-good border-good/40", Medium: "text-okay border-okay/40", Hard: "text-weak border-weak/40" };

export function ProblemBank({ rows, patterns }: { rows: Row[]; patterns: { slug: string; name: string }[] }) {
  const progress = useProgress();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("All");
  const [pattern, setPattern] = useState("all");
  const [status, setStatus] = useState<"all" | "todo" | "done">("all");

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (level !== "All" && r.level !== level) return false;
        if (pattern !== "all" && r.patternSlug !== pattern) return false;
        const done = progress.has(`dsa:${r.lc}`);
        if (status === "todo" && done) return false;
        if (status === "done" && !done) return false;
        if (q && !r.title.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [rows, level, pattern, status, q, progress],
  );
  const solved = rows.filter((r) => progress.has(`dsa:${r.lc}`)).length;

  return (
    <div>
      <div className="grid gap-px border border-border bg-border sm:grid-cols-4">
        {(["Easy", "Medium", "Hard"] as const).map((l) => {
          const all = rows.filter((r) => r.level === l);
          const d = all.filter((r) => progress.has(`dsa:${r.lc}`)).length;
          return (
            <div key={l} className="bg-bg px-4 py-3">
              <p className={`eyebrow ${LEVEL[l].split(" ")[0]}`}>{l}</p>
              <p className="mt-1 font-mono text-xl tabular-nums">
                {d}<span className="text-sm text-faint">/{all.length}</span>
              </p>
            </div>
          );
        })}
        <div className="bg-bg px-4 py-3">
          <p className="eyebrow text-muted">Total</p>
          <p className="mt-1 font-mono text-xl tabular-nums">
            {solved}<span className="text-sm text-faint">/{rows.length}</span>
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search problems…"
          className="min-h-10 min-w-[14rem] flex-1 border border-border-strong bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-fg focus:outline-none"
        />
        <select value={pattern} onChange={(e) => setPattern(e.target.value)} className="min-h-10 border border-border-strong bg-surface-2 px-3 text-sm text-fg">
          <option value="all">All patterns</option>
          {patterns.map((p) => (
            <option key={p.slug} value={p.slug}>{p.name}</option>
          ))}
        </select>
        <div className="flex border border-border-strong">
          {LEVELS.map((l) => (
            <button key={l} type="button" onClick={() => setLevel(l)} className={`min-h-10 px-3 font-mono text-xs ${level === l ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex border border-border-strong">
          {(["all", "todo", "done"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={`min-h-10 px-3 font-mono text-xs ${status === s ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto border border-border">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead className="bg-surface-2">
            <tr className="font-mono text-[11px] uppercase tracking-wide text-muted">
              <th className="w-12 border-b border-border px-4 py-2.5 font-semibold">Done</th>
              <th className="border-b border-border px-4 py-2.5 font-semibold">Problem</th>
              <th className="border-b border-border px-4 py-2.5 font-semibold">Pattern</th>
              <th className="border-b border-border px-4 py-2.5 font-semibold">Level</th>
              <th className="border-b border-border px-4 py-2.5 font-semibold">Companies</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.lc} className="bg-bg align-top transition-colors hover:bg-surface">
                <td className="border-b border-border px-4 py-3"><Check id={`dsa:${r.lc}`} label={`Mark ${r.title} solved`} /></td>
                <td className="border-b border-border px-4 py-3">
                  <a href={`https://leetcode.com/problems/${r.lc}/`} target="_blank" rel="noreferrer" className="font-medium text-fg hover:text-accent">
                    {r.title} <span className="text-faint">↗</span>
                  </a>
                  <p className="mt-1 text-xs leading-relaxed text-faint">{r.hint}</p>
                </td>
                <td className="border-b border-border px-4 py-3 whitespace-nowrap">
                  <Link href={`/dsa/${r.patternSlug}`} className="text-muted underline decoration-border-strong underline-offset-4 hover:text-fg">{r.pattern}</Link>
                </td>
                <td className="border-b border-border px-4 py-3"><span className={`eyebrow border px-1.5 py-0.5 ${LEVEL[r.level]}`}>{r.level}</span></td>
                <td className="border-b border-border px-4 py-3 font-mono text-[11px] text-faint">{r.companies?.join(", ") || "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">Nothing matches those filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
