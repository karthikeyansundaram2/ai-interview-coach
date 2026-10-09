import type { ArrayView, Aux, GraphView, GridView, IntervalsView, TableView, Tone, View } from "@/lib/dsa/types";

const CELL: Record<Tone, string> = {
  accent: "border-accent bg-accent/20 text-fg",
  good: "border-good bg-good/15 text-fg",
  okay: "border-okay bg-okay/15 text-fg",
  weak: "border-weak bg-weak/15 text-fg",
  info: "border-info bg-info/15 text-fg",
  violet: "border-violet bg-violet/15 text-fg",
  muted: "border-border bg-surface text-faint",
};
const TEXT: Record<Tone, string> = {
  accent: "text-accent",
  good: "text-good",
  okay: "text-okay",
  weak: "text-weak",
  info: "text-info",
  violet: "text-violet",
  muted: "text-faint",
};
const BAR: Record<Tone, string> = {
  accent: "bg-accent",
  good: "bg-good",
  okay: "bg-okay",
  weak: "bg-weak",
  info: "bg-info",
  violet: "bg-violet",
  muted: "bg-border-strong",
};
const VAR: Record<Tone, string> = {
  accent: "var(--color-accent)",
  good: "var(--color-good)",
  okay: "var(--color-okay)",
  weak: "var(--color-weak)",
  info: "var(--color-info)",
  violet: "var(--color-violet)",
  muted: "var(--color-border-strong)",
};

function Title({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="eyebrow mb-2 text-faint">{children}</p>;
}

/* ───────── array ───────── */
function ArrayStage({ v }: { v: ArrayView }) {
  const n = v.items.length;
  const size = n > 12 ? "w-9 text-[13px]" : n > 9 ? "w-10 text-sm" : "w-12 text-base";
  return (
    <div>
      <Title>{v.title}</Title>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex min-w-full">
          {v.items.map((item, i) => {
            const tone = v.tones?.[i];
            const dim = v.dim?.includes(i);
            const inWin = v.window && i >= v.window[0] && i <= v.window[1];
            const ptrs = v.pointers?.filter((p) => p.index === i) ?? [];
            return (
              <div key={i} className={`flex ${size} shrink-0 flex-col items-center`}>
                {v.indices !== false && (
                  <span className="h-5 font-mono text-[10px] leading-5 text-faint">{v.indexLabels?.[i] ?? i}</span>
                )}
                <div
                  className={`mx-0.5 flex h-12 w-[calc(100%-4px)] items-center justify-center border font-mono font-semibold tabular-nums transition-all duration-300 ${
                    tone ? CELL[tone] : "border-border-strong bg-surface-2 text-fg"
                  } ${dim ? "opacity-25" : ""}`}
                >
                  {item}
                </div>
                <div className={`mt-1 h-1 w-full transition-colors duration-300 ${inWin ? BAR[v.windowTone ?? "good"] : "bg-transparent"}`} />
                {v.sub && (
                  <span className="mt-1 h-5 font-mono text-xs leading-5 tabular-nums text-muted">{v.sub[i] ?? ""}</span>
                )}
                <div className="mt-1 flex min-h-5 flex-col items-center gap-0.5">
                  {ptrs.map((p) => (
                    <span key={p.label} className={`font-mono text-[11px] font-semibold leading-4 ${TEXT[p.tone ?? "accent"]}`}>
                      ↑{p.label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {v.subLabel && <p className="mt-1 font-mono text-[10px] text-faint">small numbers under the cells = {v.subLabel}</p>}
    </div>
  );
}

/* ───────── graph ───────── */
function GraphStage({ v }: { v: GraphView }) {
  const R = v.nodeRadius ?? 18;
  const pos = Object.fromEntries(v.nodes.map((n) => [n.id, n]));
  const ptrCount: Record<string, number> = {};
  return (
    <div>
      <Title>{v.title}</Title>
      <svg viewBox={`0 0 ${v.width} ${v.height}`} className="h-auto w-full" style={{ maxHeight: 340 }} role="img" aria-label="graph visualization">
        <defs>
          {(Object.keys(VAR) as Tone[]).concat([]).map((t) => (
            <marker key={t} id={`arrow-${t}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={VAR[t]} />
            </marker>
          ))}
          <marker id="arrow-default" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--color-faint)" />
          </marker>
        </defs>
        {v.edges.map((e, i) => {
          const a = pos[e.from];
          const b = pos[e.to];
          if (!a || !b) return null;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const x1 = a.x + ux * R;
          const y1 = a.y + uy * R;
          const x2 = b.x - ux * (R + (e.directed ? 3 : 0));
          const y2 = b.y - uy * (R + (e.directed ? 3 : 0));
          const stroke = e.tone ? VAR[e.tone] : "var(--color-border-strong)";
          const common = {
            stroke,
            strokeWidth: e.tone ? 2.5 : 1.75,
            fill: "none",
            strokeDasharray: e.dashed ? "5 5" : undefined,
            markerEnd: e.directed ? `url(#arrow-${e.tone ?? "default"})` : undefined,
            style: { transition: "stroke 300ms, opacity 300ms", opacity: e.hidden ? 0 : 1 },
          };
          if (e.curve) {
            const mx = (x1 + x2) / 2 - uy * len * e.curve;
            const my = (y1 + y2) / 2 + ux * len * e.curve;
            return <path key={i} d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} {...common} />;
          }
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} {...common} />;
        })}
        {v.nodes.map((n) => {
          const tone = v.tones?.[n.id];
          return (
            <g key={n.id} style={{ transition: "opacity 300ms", opacity: n.hidden ? 0 : 1 }}>
              <circle
                cx={n.x}
                cy={n.y}
                r={R}
                fill={tone && tone !== "muted" ? `color-mix(in oklab, ${VAR[tone]} 22%, var(--color-surface-2))` : "var(--color-surface-2)"}
                stroke={tone ? VAR[tone] : n.ghost ? "var(--color-border-strong)" : "var(--color-faint)"}
                strokeWidth={tone ? 2.5 : 1.5}
                strokeDasharray={n.ghost ? "3 3" : undefined}
                style={{ transition: "fill 300ms, stroke 300ms" }}
              />
              <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central" className="font-mono" fontSize={13} fontWeight={600} fill={n.ghost ? "var(--color-faint)" : "var(--color-fg)"}>
                {n.label}
              </text>
              {n.sub !== undefined && (
                <text x={n.x} y={n.y + R + 13} textAnchor="middle" className="font-mono" fontSize={10.5} fill="var(--color-muted)">
                  {n.sub}
                </text>
              )}
            </g>
          );
        })}
        {v.pointers?.map((p) => {
          const n = pos[p.node];
          if (!n) return null;
          const k = `${p.node}:${p.below ? "b" : "a"}`;
          const idx = (ptrCount[k] = (ptrCount[k] ?? -1) + 1);
          const y = p.below ? n.y + R + 16 + idx * 14 + (n.sub !== undefined ? 12 : 0) : n.y - R - 8 - idx * 14;
          return (
            <text key={`${p.label}`} x={n.x} y={y} textAnchor="middle" className="font-mono" fontSize={11.5} fontWeight={700} fill={VAR[p.tone ?? "accent"]} style={{ transition: "all 300ms" }}>
              {p.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/* ───────── grid ───────── */
function GridStage({ v }: { v: GridView }) {
  const cols = v.cells[0]?.length ?? 0;
  return (
    <div>
      <Title>{v.title}</Title>
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 2.75rem))` }}>
        {v.cells.map((row, r) =>
          row.map((c, ci) => {
            const tone = v.tones?.[`${r},${ci}`];
            const cur = v.cursor && v.cursor[0] === r && v.cursor[1] === ci;
            return (
              <div
                key={`${r},${ci}`}
                className={`flex aspect-square items-center justify-center border font-mono text-sm font-semibold transition-all duration-300 ${
                  tone ? CELL[tone] : c === "0" ? "border-border bg-surface text-faint" : "border-border-strong bg-surface-3 text-fg"
                } ${cur ? "ring-2 ring-fg ring-offset-2 ring-offset-bg" : ""}`}
              >
                {c === "0" ? "~" : c}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

/* ───────── table ───────── */
function TableStage({ v }: { v: TableView }) {
  return (
    <div className="overflow-x-auto">
      <Title>{v.title}</Title>
      <table className="border-collapse font-mono text-sm tabular-nums">
        <thead>
          <tr>
            <th className="h-9 w-9" />
            {v.colHeaders.map((h, j) => (
              <th key={j} className="h-9 w-10 text-center text-xs font-semibold text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {v.cells.map((row, i) => (
            <tr key={i}>
              <th className="pr-2 text-right text-xs font-semibold text-muted">{v.rowHeaders[i]}</th>
              {row.map((c, j) => {
                const tone = v.tones?.[`${i},${j}`];
                const cur = v.cursor && v.cursor[0] === i && v.cursor[1] === j;
                return (
                  <td key={j} className="p-0.5">
                    <div
                      className={`flex h-9 w-10 items-center justify-center border transition-all duration-300 ${
                        tone ? CELL[tone] : c === null ? "border-border bg-transparent text-faint" : "border-border-strong bg-surface-2 text-fg"
                      } ${cur ? "ring-2 ring-fg ring-offset-1 ring-offset-bg" : ""}`}
                    >
                      {c ?? ""}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────── intervals ───────── */
function IntervalsStage({ v }: { v: IntervalsView }) {
  const span = Math.max(1, v.max - v.min);
  const pct = (x: number) => ((x - v.min) / span) * 100;
  const ticks = Array.from({ length: Math.min(span, 20) + 1 }, (_, i) => Math.round(v.min + (i * span) / Math.min(span, 20)));
  return (
    <div>
      <Title>{v.title}</Title>
      <div className="space-y-1.5">
        {v.rows.map((row, ri) => (
          <div key={ri} className={`flex items-center gap-3 ${row.label === "merged" ? "mt-3 border-t border-border pt-3" : ""}`}>
            <span className="w-20 shrink-0 text-right font-mono text-[11px] text-muted">{row.label}</span>
            <div className="relative h-6 flex-1">
              {row.items.map((it, k) => (
                <div
                  key={k}
                  className={`absolute top-0 h-6 border transition-all duration-300 ${CELL[it.tone ?? "info"]} ${it.dim ? "opacity-30" : ""}`}
                  style={{ left: `${pct(it.range[0])}%`, width: `max(6px, ${pct(it.range[1]) - pct(it.range[0])}%)` }}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <span className="w-20 shrink-0" />
          <div className="relative h-4 flex-1">
            {ticks.map((t) => (
              <span key={t} className="absolute -translate-x-1/2 font-mono text-[10px] text-faint" style={{ left: `${pct(t)}%` }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ViewStage({ view }: { view: View }) {
  switch (view.kind) {
    case "array":
      return <ArrayStage v={view} />;
    case "graph":
      return <GraphStage v={view} />;
    case "grid":
      return <GridStage v={view} />;
    case "table":
      return <TableStage v={view} />;
    case "intervals":
      return <IntervalsStage v={view} />;
  }
}

export function AuxPanel({ aux }: { aux: Aux }) {
  const items = aux.items as unknown[];
  const isMap = aux.kind === "map";
  return (
    <div className="min-w-0">
      <p className="eyebrow mb-1.5 text-faint">{aux.label}</p>
      <div className="flex min-h-9 flex-wrap items-center gap-1">
        {aux.kind === "queue" && items.length > 0 && <span className="mr-1 font-mono text-[10px] text-faint">front</span>}
        {aux.kind === "stack" && items.length > 0 && <span className="mr-1 font-mono text-[10px] text-faint">bottom</span>}
        {items.length === 0 && <span className="font-mono text-xs text-faint">{aux.empty ?? "—"}</span>}
        {items.map((it, i) => {
          const hi = aux.highlight?.includes(i);
          const label = isMap ? `${(it as [unknown, unknown])[0]}: ${(it as [unknown, unknown])[1]}` : String(it);
          return (
            <span
              key={i}
              className={`border px-2 py-1 font-mono text-xs transition-colors duration-300 ${hi ? "border-accent bg-accent/15 text-fg" : "border-border-strong bg-surface-2 text-muted"}`}
            >
              {label}
            </span>
          );
        })}
        {aux.kind === "stack" && items.length > 0 && <span className="ml-1 font-mono text-[10px] text-faint">← top</span>}
        {aux.kind === "queue" && items.length > 0 && <span className="ml-1 font-mono text-[10px] text-faint">back</span>}
      </div>
    </div>
  );
}
