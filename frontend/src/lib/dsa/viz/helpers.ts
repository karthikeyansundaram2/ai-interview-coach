import type { Aux, Cell, Frame, GraphEdge, GraphNode, Inputs, View } from "../types";

export function nums(raw: string | undefined, fallback: number[], max = 14): number[] {
  if (!raw) return fallback;
  const out = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.trunc(n));
  return out.length ? out.slice(0, max) : fallback;
}

export function num(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return raw !== undefined && raw.trim() !== "" && Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function text(raw: string | undefined, fallback: string, max = 14): string {
  const s = (raw ?? "").trim();
  return (s || fallback).slice(0, max);
}

/** Tiny recorder so traces read top-to-bottom like the algorithm. */
export function recorder() {
  const frames: Frame[] = [];
  return {
    frames,
    push(
      line: number,
      note: string,
      views: View[],
      extra: { aux?: Aux[]; vars?: Frame["vars"]; done?: boolean } = {},
    ) {
      // deep-copy views so later mutation of shared arrays can't leak into earlier frames
      frames.push({ line, note, views: structuredClone(views), aux: structuredClone(extra.aux), vars: extra.vars ? { ...extra.vars } : undefined, done: extra.done });
    },
  };
}

export function inputsOf(spec: { inputs?: { key: string; default: string }[] }): Inputs {
  return Object.fromEntries((spec.inputs ?? []).map((f) => [f.key, f.default]));
}

/** Lay out a binary tree given as a level-order array (null = missing). */
export function layoutTree(
  values: (Cell | null)[],
  width = 560,
  levelGap = 68,
): { nodes: GraphNode[]; edges: GraphEdge[]; height: number; left: (number | null)[]; right: (number | null)[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const left: (number | null)[] = values.map(() => null);
  const right: (number | null)[] = values.map(() => null);
  if (!values.length || values[0] === null) return { nodes, edges, height: 80, left, right };

  // build children links from level-order (LeetCode style)
  const queue: number[] = [0];
  let i = 1;
  while (queue.length && i < values.length) {
    const p = queue.shift()!;
    if (i < values.length) {
      if (values[i] !== null) {
        left[p] = i;
        queue.push(i);
      }
      i++;
    }
    if (i < values.length) {
      if (values[i] !== null) {
        right[p] = i;
        queue.push(i);
      }
      i++;
    }
  }

  // in-order x positions, depth y positions
  const xs: Record<number, number> = {};
  const ys: Record<number, number> = {};
  let order = 0;
  let maxDepth = 0;
  const walk = (n: number | null, d: number) => {
    if (n === null) return;
    walk(left[n], d + 1);
    xs[n] = order++;
    ys[n] = d;
    maxDepth = Math.max(maxDepth, d);
    walk(right[n], d + 1);
  };
  walk(0, 0);
  const count = order;
  const pad = 36;
  const step = count > 1 ? (width - pad * 2) / (count - 1) : 0;
  for (const k of Object.keys(xs)) {
    const idx = Number(k);
    nodes.push({ id: String(idx), x: count > 1 ? pad + xs[idx] * step : width / 2, y: 32 + ys[idx] * levelGap, label: values[idx] as Cell });
    if (left[idx] !== null) edges.push({ from: String(idx), to: String(left[idx]) });
    if (right[idx] !== null) edges.push({ from: String(idx), to: String(right[idx]) });
  }
  return { nodes, edges, height: 64 + maxDepth * levelGap, left, right };
}

/** Heap stored as array → tree layout by index. */
export function heapTree(heap: number[], width = 420): { nodes: GraphNode[]; edges: GraphEdge[]; height: number } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const levels = Math.max(1, Math.ceil(Math.log2(heap.length + 1)));
  heap.forEach((v, i) => {
    const level = Math.floor(Math.log2(i + 1));
    const posInLevel = i - (2 ** level - 1);
    const slots = 2 ** level;
    const x = ((posInLevel + 0.5) / slots) * width;
    nodes.push({ id: String(i), x, y: 30 + level * 62, label: v });
    if (i > 0) edges.push({ from: String(Math.floor((i - 1) / 2)), to: String(i) });
  });
  return { nodes, edges, height: 60 + (levels - 1) * 62 };
}
