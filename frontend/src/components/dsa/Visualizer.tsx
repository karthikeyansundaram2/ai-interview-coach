"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AuxPanel, ViewStage } from "@/components/dsa/Views";
import { highlightLine } from "@/lib/highlight";
import { VIZ } from "@/lib/dsa/viz";
import { inputsOf } from "@/lib/dsa/viz/helpers";
import type { Inputs } from "@/lib/dsa/types";

const SPEEDS = [
  { label: "0.5×", ms: 2200 },
  { label: "1×", ms: 1300 },
  { label: "2×", ms: 650 },
];

export function Visualizer({ slug }: { slug: string }) {
  const spec = VIZ[slug];
  const defaults = useMemo(() => (spec ? inputsOf(spec) : {}), [spec]);
  const [draft, setDraft] = useState<Inputs>(defaults);
  const [applied, setApplied] = useState<Inputs>(defaults);
  const frames = useMemo(() => (spec ? spec.trace(applied) : []), [spec, applied]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);

  const last = frames.length - 1;
  const frame = frames[Math.min(idx, last)];

  useEffect(() => {
    if (!playing || idx >= last) return;
    const t = setTimeout(() => {
      const n = Math.min(idx + 1, last);
      setIdx(n);
      if (n >= last) setPlaying(false);
    }, SPEEDS[speed].ms);
    return () => clearTimeout(t);
  }, [playing, idx, last, speed]);

  const step = useCallback((d: number) => {
    setPlaying(false);
    setIdx((i) => Math.max(0, Math.min(last, i + d)));
  }, [last]);

  const toggle = useCallback(() => {
    if (idx >= last) {
      setIdx(0);
      setPlaying(true);
    } else setPlaying((p) => !p);
  }, [idx, last]);

  function onKey(e: React.KeyboardEvent) {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    } else if (e.key === " ") {
      e.preventDefault();
      toggle();
    }
  }

  function run(e: FormEvent) {
    e.preventDefault();
    setApplied({ ...draft });
    setIdx(0);
    setPlaying(true);
  }

  if (!spec || !frame) return null;
  const codeLines = spec.code.split("\n");
  const progress = last > 0 ? (idx / last) * 100 : 100;

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKey}
      className="border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/40"
      aria-label={`${spec.title} visualizer. Use left and right arrows to step, space to play.`}
    >
      {/* header */}
      <div className="flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:px-5">
        <div>
          <p className="eyebrow text-accent">Visualize</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">{spec.title}</h3>
        </div>
        <p className="max-w-md text-sm text-muted sm:text-right">{spec.problem}</p>
      </div>

      {/* inputs */}
      {spec.inputs && spec.inputs.length > 0 && (
        <form onSubmit={run} className="flex flex-wrap items-end gap-3 border-b border-border px-4 py-3 sm:px-5">
          {spec.inputs.map((f) => (
            <label key={f.key} className={`flex flex-col gap-1 ${f.type === "number" ? "w-28" : "min-w-[12rem] flex-1"}`}>
              <span className="eyebrow text-faint">{f.label}</span>
              <input
                value={draft[f.key] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                inputMode={f.type === "text" ? "text" : "numeric"}
                spellCheck={false}
                className="min-h-10 border border-border-strong bg-surface-2 px-3 font-mono text-sm text-fg focus:border-fg focus:outline-none"
              />
              {f.hint && <span className="text-[11px] text-faint">{f.hint}</span>}
            </label>
          ))}
          <div className="flex gap-2">
            <button type="submit" className="min-h-10 bg-accent px-4 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-strong">
              Run
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(defaults);
                setApplied(defaults);
                setIdx(0);
                setPlaying(false);
              }}
              className="min-h-10 border border-border-strong px-3 text-sm text-muted transition-colors hover:border-fg hover:text-fg"
            >
              Reset
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
        {/* stage */}
        <div className="min-w-0 border-b border-border lg:border-r lg:border-b-0">
          <div className="space-y-6 px-4 py-6 sm:px-6">
            {frame.views.map((v, i) => (
              <ViewStage key={i} view={v} />
            ))}
            {frame.aux && frame.aux.length > 0 && (
              <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                {frame.aux.map((a) => (
                  <AuxPanel key={a.label} aux={a} />
                ))}
              </div>
            )}
          </div>
          {/* narration */}
          <div className={`border-t border-border px-4 py-4 sm:px-6 ${frame.done ? "bg-good/5" : ""}`} aria-live="polite">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 font-mono text-xs tabular-nums ${frame.done ? "text-good" : "text-accent"}`}>
                {String(idx + 1).padStart(2, "0")}/{String(frames.length).padStart(2, "0")}
              </span>
              <p className="text-[15px] leading-relaxed text-fg">{frame.note}</p>
            </div>
          </div>
          {/* controls */}
          <div className="border-t border-border px-4 py-3 sm:px-6">
            <div className="mb-3 h-1 w-full bg-surface-3">
              <div className="h-1 bg-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CtrlButton onClick={() => { setPlaying(false); setIdx(0); }} label="Restart">⟲</CtrlButton>
              <CtrlButton onClick={() => step(-1)} label="Previous step" disabled={idx === 0}>←</CtrlButton>
              <button
                type="button"
                onClick={toggle}
                className="min-h-10 min-w-24 bg-fg px-4 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
              >
                {playing ? "Pause" : idx >= last ? "Replay" : idx === 0 ? "Play" : "Resume"}
              </button>
              <CtrlButton onClick={() => step(1)} label="Next step" disabled={idx >= last}>→</CtrlButton>
              <div className="ml-auto flex items-center gap-1">
                {SPEEDS.map((s, i) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setSpeed(i)}
                    className={`min-h-9 px-2 font-mono text-xs transition-colors ${speed === i ? "bg-surface-3 text-fg" : "text-faint hover:text-fg"}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={last}
              value={idx}
              onChange={(e) => {
                setPlaying(false);
                setIdx(Number(e.target.value));
              }}
              aria-label="Scrub through steps"
              className="mt-3 w-full accent-[var(--color-accent)]"
            />
            <p className="mt-1 hidden font-mono text-[10px] text-faint sm:block">Keys: ← → step · space play/pause</p>
          </div>
        </div>

        {/* code + vars */}
        <div className="min-w-0 bg-bg/40">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="eyebrow text-faint">python</span>
            <span className="font-mono text-[11px] text-faint">line {frame.line}</span>
          </div>
          <pre className="overflow-x-auto py-3 font-mono text-[12.5px] leading-[1.7]">
            <code>
              {codeLines.map((l, i) => {
                const active = i + 1 === frame.line;
                return (
                  <span
                    key={i}
                    className={`flex border-l-2 pr-4 transition-colors duration-200 ${active ? "border-accent bg-accent/10" : "border-transparent"}`}
                  >
                    <span className={`w-9 shrink-0 select-none pr-3 text-right ${active ? "text-accent" : "text-faint/60"}`}>{i + 1}</span>
                    <span className="whitespace-pre">{highlightLine(l)}</span>
                  </span>
                );
              })}
            </code>
          </pre>
          {frame.vars && Object.keys(frame.vars).length > 0 && (
            <div className="border-t border-border px-4 py-3">
              <p className="eyebrow mb-2 text-faint">variables</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[13px]">
                {Object.entries(frame.vars).map(([k, v]) => (
                  <div key={k} className="flex min-w-0 items-baseline gap-2">
                    <dt className="text-muted">{k}</dt>
                    <dd className="truncate font-semibold text-fg">{v === null ? "None" : String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CtrlButton({ children, onClick, label, disabled }: { children: React.ReactNode; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className="min-h-10 min-w-10 border border-border-strong font-mono text-sm text-fg transition-colors hover:border-fg disabled:opacity-30"
    >
      {children}
    </button>
  );
}
