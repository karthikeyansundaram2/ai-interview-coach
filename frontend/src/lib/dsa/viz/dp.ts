import type { ArrayView, GraphEdge, GraphNode, GraphView, TableView, Tone, VizSpec } from "../types";
import { nums, recorder, text } from "./helpers";

/* ───────────────────────── Backtracking (subsets) ───────────────────────── */
export const backtracking: VizSpec = {
  title: "Subsets — walk the decision tree",
  problem: "Return every subset of nums. Each node of the tree is one subset.",
  code: `def subsets(nums):
    result, path = [], []
    def backtrack(start):
        result.append(path[:])          # every node is an answer
        for i in range(start, len(nums)):
            path.append(nums[i])        # choose
            backtrack(i + 1)            # explore
            path.pop()                  # un-choose
    backtrack(0)
    return result`,
  inputs: [{ key: "nums", label: "nums (up to 4)", type: "numbers", default: "1, 2, 3" }],
  trace(inp) {
    const a = nums(inp.nums, [1, 2, 3], 4);
    // build the full tree first so layout is stable while nodes reveal
    type T = { id: string; path: number[]; start: number; depth: number; kids: T[]; x?: number };
    const build = (path: number[], start: number, depth: number, id: string): T => ({
      id,
      path,
      start,
      depth,
      kids: a.slice(start).map((_, k) => build([...path, start + k], start + k + 1, depth + 1, `${id}.${start + k}`)),
    });
    const root = build([], 0, 0, "r");
    let leaf = 0;
    let maxDepth = 0;
    const place = (t: T) => {
      maxDepth = Math.max(maxDepth, t.depth);
      if (!t.kids.length) {
        t.x = leaf++;
        return;
      }
      t.kids.forEach(place);
      t.x = (t.kids[0].x! + t.kids[t.kids.length - 1].x!) / 2;
    };
    place(root);
    const width = Math.max(360, leaf * 74 + 40);
    const scale = leaf > 1 ? (width - 80) / (leaf - 1) : 0;
    const allNodes: GraphNode[] = [];
    const allEdges: GraphEdge[] = [];
    const walk = (t: T) => {
      const label = t.path.length ? a[t.path[t.path.length - 1]] : "∅";
      allNodes.push({ id: t.id, x: 40 + t.x! * scale, y: 30 + t.depth * 74, label, sub: `[${t.path.map((i) => a[i]).join(",")}]` });
      t.kids.forEach((k) => {
        allEdges.push({ from: t.id, to: k.id });
        walk(k);
      });
    };
    walk(root);

    const r = recorder();
    const shown = new Set<string>();
    const done = new Set<string>();
    const pathIds: string[] = [];
    const path: number[] = [];
    const result: string[] = [];
    const view = (cur: string, hiEdge?: string): GraphView => {
      const tones: Record<string, Tone> = {};
      done.forEach((d) => (tones[d] = "muted"));
      pathIds.forEach((p) => (tones[p] = "info"));
      tones[cur] = "accent";
      return {
        kind: "graph",
        width,
        height: 64 + maxDepth * 74,
        nodes: allNodes.map((n) => ({ ...n, hidden: !shown.has(n.id) })),
        edges: allEdges.map((e) => ({ ...e, hidden: !shown.has(e.to), tone: e.to === hiEdge ? "accent" : pathIds.includes(e.to) ? "info" : undefined })),
        tones,
      };
    };
    const aux = () => [
      { label: "path", kind: "list" as const, items: [...path], empty: "[]" },
      { label: `result (${result.length})`, kind: "list" as const, items: [...result], empty: "[]" },
    ];
    const go = (t: T) => {
      shown.add(t.id);
      pathIds.push(t.id);
      result.push(`[${path.join(",")}]`);
      r.push(4, `Record [${path.join(", ")}] — every node in this tree is a valid subset.`, [view(t.id)], { aux: aux(), vars: { start: t.start } });
      for (const k of t.kids) {
        const idx = k.path[k.path.length - 1];
        path.push(a[idx]);
        shown.add(k.id);
        r.push(6, `Choose ${a[idx]} → path [${path.join(", ")}].`, [view(t.id, k.id)], { aux: aux(), vars: { start: t.start, i: idx } });
        go(k);
        path.pop();
        r.push(8, `Un-choose ${a[idx]} → back to [${path.join(", ")}] to try the next option.`, [view(t.id)], { aux: aux(), vars: { start: t.start, i: idx } });
      }
      pathIds.pop();
      done.add(t.id);
    };
    go(root);
    r.push(10, `All ${result.length} = 2^${a.length} subsets found. Starting each loop at i+1 is what prevents duplicates like [2,1].`, [view("r")], { aux: aux(), done: true });
    return r.frames;
  },
};

/* ───────────────────────── 1-D DP (house robber) ───────────────────────── */
export const dp1d: VizSpec = {
  title: "House robber — take it or skip it",
  problem: "Maximize loot from a row of houses without robbing two neighbours.",
  code: `def rob(houses):
    n = len(houses)
    dp = [0] * (n + 1)      # dp[i] = best from first i houses
    dp[1] = houses[0]
    for i in range(2, n + 1):
        skip = dp[i - 1]                    # leave house i-1
        take = dp[i - 2] + houses[i - 1]    # rob it, skip its neighbour
        dp[i] = max(skip, take)
    return dp[n]`,
  inputs: [{ key: "houses", label: "houses", type: "numbers", default: "2, 7, 9, 3, 1, 5, 8" }],
  trace(inp) {
    const h = nums(inp.houses, [2, 7, 9, 3, 1, 5, 8], 10).map((x) => Math.max(0, x));
    const n = h.length;
    const dp: (number | null)[] = new Array(n + 1).fill(null);
    const r = recorder();
    const views = (house: number, hTones: Record<number, Tone> = {}, dTones: Record<number, Tone> = {}) => {
      const hv: ArrayView = { kind: "array", title: "houses", items: h, pointers: house >= 0 ? [{ label: "house", index: house, tone: "accent" }] : [], tones: hTones };
      const dv: ArrayView = { kind: "array", title: "dp[i] = best loot using the first i houses", items: dp.map((d) => (d === null ? "·" : d)), indexLabels: dp.map((_, i) => `dp${i}`), tones: dTones };
      return [hv, dv];
    };
    dp[0] = 0;
    r.push(3, "dp[0] = 0: with no houses, there's nothing to take.", views(-1, {}, { 0: "good" }));
    dp[1] = h[0];
    r.push(4, `dp[1] = ${h[0]}: with one house, rob it.`, views(0, { 0: "accent" }, { 1: "good" }));
    for (let i = 2; i <= n; i++) {
      const skip = dp[i - 1]!;
      const take = dp[i - 2]! + h[i - 1];
      r.push(6, `House ${i - 1} (${h[i - 1]}). Skip it → keep dp[${i - 1}] = ${skip}.`, views(i - 1, { [i - 1]: "accent" }, { [i - 1]: "info" }), { vars: { i, skip } });
      r.push(7, `Take it → dp[${i - 2}] + ${h[i - 1]} = ${take} (can't use house ${i - 2}).`, views(i - 1, { [i - 1]: "accent" }, { [i - 2]: "violet" }), { vars: { i, skip, take } });
      dp[i] = Math.max(skip, take);
      r.push(8, `dp[${i}] = max(${skip}, ${take}) = ${dp[i]}${take > skip ? " → take" : " → skip"}.`, views(i - 1, { [i - 1]: "accent" }, { [i]: "good", [take > skip ? i - 2 : i - 1]: take > skip ? "violet" : "info" }), { vars: { i, skip, take, "dp[i]": dp[i] } });
    }
    // reconstruct
    const robbed: Record<number, Tone> = {};
    let i = n;
    while (i >= 1) {
      if (i === 1 || dp[i] !== dp[i - 1]) {
        robbed[i - 1] = "good";
        i -= 2;
      } else i -= 1;
    }
    r.push(9, `Best = dp[${n}] = ${dp[n]}. Green houses are one optimal choice. Each state used just the two before it → O(n), or O(1) space with two variables.`, views(-1, robbed, { [n]: "good" }), { vars: { answer: dp[n] }, done: true });
    return r.frames;
  },
};

/* ───────────────────────── 2-D DP (LCS) ───────────────────────── */
export const dp2d: VizSpec = {
  title: "Longest common subsequence",
  problem: "Length of the longest sequence of characters appearing in order (not necessarily adjacent) in both strings.",
  code: `def lcs(a, b):
    m, n = len(a), len(b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1   # extend the match
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[m][n]`,
  inputs: [
    { key: "a", label: "a", type: "text", default: "ABCBDA" },
    { key: "b", label: "b", type: "text", default: "BDCAB" },
  ],
  trace(inp) {
    const a = text(inp.a, "ABCBDA", 8);
    const b = text(inp.b, "BDCAB", 8);
    const m = a.length;
    const n = b.length;
    const dp: (number | null)[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 || j === 0 ? 0 : null)));
    const r = recorder();
    const view = (tones: Record<string, Tone> = {}, cursor?: [number, number]): TableView => ({
      kind: "table",
      rowHeaders: ["∅", ...a.split("")],
      colHeaders: ["∅", ...b.split("")],
      cells: dp,
      tones,
      cursor,
    });
    r.push(3, "Row/column 0 = an empty string: LCS with nothing is 0. dp[i][j] = LCS of a[:i] and b[:j].", [view()]);
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1]! + 1;
          r.push(7, `a[${i - 1}] = b[${j - 1}] = '${a[i - 1]}' → match! Diagonal ${dp[i - 1][j - 1]} + 1 = ${dp[i][j]}.`, [view({ [`${i - 1},${j - 1}`]: "violet", [`${i},${j}`]: "good" }, [i, j])], { vars: { i, j, "a[i-1]": a[i - 1], "b[j-1]": b[j - 1], "dp[i][j]": dp[i][j] } });
        } else {
          dp[i][j] = Math.max(dp[i - 1][j]!, dp[i][j - 1]!);
          r.push(9, `'${a[i - 1]}' ≠ '${b[j - 1]}' → drop one char: max(up ${dp[i - 1][j]}, left ${dp[i][j - 1]}) = ${dp[i][j]}.`, [view({ [`${i - 1},${j}`]: "info", [`${i},${j - 1}`]: "info", [`${i},${j}`]: "accent" }, [i, j])], { vars: { i, j, "a[i-1]": a[i - 1], "b[j-1]": b[j - 1], "dp[i][j]": dp[i][j] } });
        }
      }
    }
    // trace back
    const path: Record<string, Tone> = {};
    let i = m;
    let j = n;
    let s = "";
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) {
        path[`${i},${j}`] = "good";
        s = a[i - 1] + s;
        i--;
        j--;
      } else if (dp[i - 1][j]! >= dp[i][j - 1]!) i--;
      else j--;
    }
    r.push(10, `LCS length = ${dp[m][n]} ("${s}"). Walking back from the corner, every diagonal match step is one shared character. O(m·n).`, [view(path)], { vars: { answer: dp[m][n], lcs: s }, done: true });
    return r.frames;
  },
};
