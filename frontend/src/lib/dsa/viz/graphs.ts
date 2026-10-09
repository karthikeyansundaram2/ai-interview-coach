import type { ArrayView, Cell, GraphEdge, GraphNode, GraphView, GridView, Tone, VizSpec } from "../types";
import { recorder } from "./helpers";

const PALETTE: Tone[] = ["good", "info", "violet", "okay", "accent"];

/* ───────────────────────── Grid DFS (islands) ───────────────────────── */
const GRID = ["110001", "110101", "000110", "100000", "110111"];

export const graphTraversal: VizSpec = {
  title: "Number of islands — flood fill",
  problem: "Count groups of '1's connected up/down/left/right.",
  code: `def num_islands(grid):
    rows, cols = len(grid), len(grid[0])
    def sink(r, c):
        if not (0 <= r < rows and 0 <= c < cols) or grid[r][c] != "1":
            return
        grid[r][c] = "#"            # mark visited
        for dr, dc in ((1,0), (-1,0), (0,1), (0,-1)):
            sink(r + dr, c + dc)
    count = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == "1":
                count += 1
                sink(r, c)
    return count`,
  trace() {
    const g: Cell[][] = GRID.map((row) => row.split(""));
    const rows = g.length;
    const cols = g[0].length;
    const tones: Record<string, Tone> = {};
    const r = recorder();
    let count = 0;
    const depth: string[] = [];
    const view = (cursor?: [number, number], extra: Record<string, Tone> = {}): GridView => ({ kind: "grid", cells: g, tones: { ...tones, ...extra }, cursor });
    const aux = () => [{ label: "recursion stack (sink calls)", kind: "stack" as const, items: [...depth], empty: "empty" }];
    r.push(9, "Scan every cell. Each time we hit unvisited land, that's a new island — then sink all of it so it's never counted again.", [view()], { aux: aux(), vars: { count } });
    const sink = (rr: number, cc: number, tone: Tone) => {
      if (rr < 0 || rr >= rows || cc < 0 || cc >= cols || g[rr][cc] !== "1") return;
      g[rr][cc] = "#";
      tones[`${rr},${cc}`] = tone;
      depth.push(`(${rr},${cc})`);
      r.push(6, `Sink (${rr},${cc}) and spread to its 4 neighbours.`, [view([rr, cc])], { aux: aux(), vars: { r: rr, c: cc, count } });
      sink(rr + 1, cc, tone);
      sink(rr - 1, cc, tone);
      sink(rr, cc + 1, tone);
      sink(rr, cc - 1, tone);
      depth.pop();
    };
    for (let rr = 0; rr < rows; rr++) {
      for (let cc = 0; cc < cols; cc++) {
        if (g[rr][cc] === "1") {
          count++;
          r.push(13, `New land at (${rr},${cc}) → island #${count}.`, [view([rr, cc], { [`${rr},${cc}`]: "accent" })], { aux: aux(), vars: { r: rr, c: cc, count } });
          sink(rr, cc, PALETTE[(count - 1) % PALETTE.length]);
          r.push(14, `Island #${count} fully sunk. Back to scanning.`, [view()], { aux: aux(), vars: { count } });
        } else {
          r.push(12, g[rr][cc] === "#" ? `(${rr},${cc}) already sunk — skip.` : `(${rr},${cc}) is water — skip.`, [view([rr, cc])], { aux: aux(), vars: { r: rr, c: cc, count } });
        }
      }
    }
    r.push(15, `Done: ${count} islands. Every cell is visited a constant number of times → O(rows × cols).`, [view()], { aux: aux(), vars: { count }, done: true });
    return r.frames;
  },
};

/* ───────────────────────── Topological sort (Kahn) ───────────────────────── */
const TOPO_POS: [number, number][] = [
  [50, 50],
  [50, 180],
  [200, 50],
  [200, 180],
  [350, 115],
  [490, 115],
];
const TOPO_EDGES: [number, number][] = [
  [0, 2],
  [1, 2],
  [1, 3],
  [2, 4],
  [3, 4],
  [3, 5],
  [4, 5],
];

export const topologicalSort: VizSpec = {
  title: "Course order with Kahn's algorithm",
  problem: "6 courses, edges a → b mean 'take a before b'. Find a valid order (or detect a cycle).",
  code: `from collections import deque
def topo_order(n, edges):
    graph = [[] for _ in range(n)]
    indegree = [0] * n
    for a, b in edges:            # a must come before b
        graph[a].append(b)
        indegree[b] += 1
    queue = deque(i for i in range(n) if indegree[i] == 0)
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for nxt in graph[node]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)
    return order if len(order) == n else []   # [] = cycle`,
  trace() {
    const n = TOPO_POS.length;
    const indeg = new Array(n).fill(0);
    const graph: number[][] = Array.from({ length: n }, () => []);
    for (const [a, b] of TOPO_EDGES) {
      graph[a].push(b);
      indeg[b]++;
    }
    const used = new Set<string>();
    const done = new Set<number>();
    const queue: number[] = [];
    const order: number[] = [];
    const r = recorder();
    const view = (cur?: number, hiEdge?: string, extra: Record<string, Tone> = {}): GraphView => {
      const tones: Record<string, Tone> = {};
      done.forEach((d) => (tones[String(d)] = "good"));
      queue.forEach((q) => (tones[String(q)] = "info"));
      if (cur !== undefined) tones[String(cur)] = "accent";
      return {
        kind: "graph",
        width: 540,
        height: 230,
        nodes: TOPO_POS.map(([x, y], i) => ({ id: String(i), x, y, label: i, sub: `in=${indeg[i]}` })),
        edges: TOPO_EDGES.map(([a, b]) => {
          const id = `${a}-${b}`;
          return { from: String(a), to: String(b), directed: true, tone: id === hiEdge ? "accent" : undefined, dashed: used.has(id) && id !== hiEdge, hidden: false } as GraphEdge;
        }),
        tones: { ...tones, ...extra },
      };
    };
    const aux = () => [
      { label: "queue (ready: in-degree 0)", kind: "queue" as const, items: [...queue], empty: "empty" },
      { label: "order", kind: "list" as const, items: [...order], empty: "[]" },
    ];
    r.push(7, "Count prerequisites per course (in-degree). A course with in=0 has nothing blocking it.", [view()], { aux: aux() });
    for (let i = 0; i < n; i++) if (indeg[i] === 0) queue.push(i);
    r.push(8, `Courses ${queue.join(" and ")} have no prerequisites — they're ready now.`, [view()], { aux: aux() });
    while (queue.length) {
      const node = queue.shift()!;
      order.push(node);
      done.add(node);
      r.push(12, `Take course ${node}. Add it to the order.`, [view(node)], { aux: aux(), vars: { node } });
      for (const nx of graph[node]) {
        indeg[nx]--;
        const id = `${node}-${nx}`;
        used.add(id);
        r.push(14, `Course ${nx} loses one prerequisite → in=${indeg[nx]}.`, [view(node, id)], { aux: aux(), vars: { node, nxt: nx, "indegree[nxt]": indeg[nx] } });
        if (indeg[nx] === 0) {
          queue.push(nx);
          r.push(16, `Course ${nx} is now unblocked → enqueue.`, [view(node, undefined, { [String(nx)]: "info" })], { aux: aux(), vars: { node, nxt: nx } });
        }
      }
    }
    r.push(17, `Order ${order.join(" → ")} uses all ${n} courses, so there's no cycle. O(V + E).`, [view()], { aux: aux(), done: true });
    return r.frames;
  },
};

/* ───────────────────────── Union-Find ───────────────────────── */
const UF_POS: [number, number][] = [
  [50, 50],
  [150, 50],
  [150, 150],
  [50, 150],
  [290, 50],
  [390, 50],
  [340, 150],
  [480, 100],
];
const UF_EDGES: [number, number][] = [
  [0, 1],
  [2, 3],
  [1, 3],
  [4, 5],
  [5, 6],
  [4, 6],
];

export const unionFind: VizSpec = {
  title: "Counting connected components",
  problem: "8 nodes, a list of edges. How many separate groups are there?",
  code: `def count_components(n, edges):
    parent = list(range(n))
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]   # path halving
            x = parent[x]
        return x
    components = n
    for a, b in edges:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb                 # union
            components -= 1
    return components`,
  trace() {
    const n = UF_POS.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x: number) => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    };
    const rootOf = (x: number) => {
      while (parent[x] !== x) x = parent[x];
      return x;
    };
    const state: Record<string, "merged" | "redundant"> = {};
    let components = n;
    const r = recorder();
    const views = (cur?: number, hi: Record<number, Tone> = {}) => {
      const roots = [...new Set(parent.map((_, i) => rootOf(i)))].sort((a, b) => a - b);
      const tones: Record<string, Tone> = {};
      parent.forEach((_, i) => {
        const size = parent.filter((__, j) => rootOf(j) === rootOf(i)).length;
        if (size > 1) tones[String(i)] = PALETTE[roots.indexOf(rootOf(i)) % PALETTE.length];
      });
      const nodes: GraphNode[] = UF_POS.map(([x, y], i) => ({ id: String(i), x, y, label: i, sub: parent[i] === i ? "root" : undefined }));
      const g: GraphView = {
        kind: "graph",
        title: "graph (colour = group)",
        width: 530,
        height: 200,
        nodes,
        edges: UF_EDGES.map(([a, b], i) => ({
          from: String(a),
          to: String(b),
          tone: i === cur ? "accent" : state[i] === "redundant" ? "weak" : state[i] === "merged" ? "good" : undefined,
          dashed: state[i] === undefined && i !== cur ? true : state[i] === "redundant",
        })),
        tones,
      };
      const arr: ArrayView = { kind: "array", title: "parent[]", items: [...parent], tones: hi, indices: true };
      return [g, arr];
    };
    r.push(2, "Every node starts as its own group: parent[i] = i. 8 components.", views(), { vars: { components } });
    UF_EDGES.forEach(([a, b], i) => {
      const ra = find(a);
      const rb = find(b);
      r.push(10, `Edge ${a}–${b}: find(${a}) = ${ra}, find(${b}) = ${rb}.`, views(i, { [ra]: "info", [rb]: "violet" }), { vars: { a, b, ra, rb, components } });
      if (ra !== rb) {
        parent[ra] = rb;
        components--;
        state[i] = "merged";
        r.push(12, `Different roots → union: parent[${ra}] = ${rb}. Two groups become one.`, views(i, { [ra]: "good" }), { vars: { a, b, ra, rb, components } });
      } else {
        state[i] = "redundant";
        r.push(11, `Same root (${ra}) → already connected. This edge is redundant (it would form a cycle).`, views(i, { [ra]: "weak" }), { vars: { a, b, ra, rb, components } });
      }
    });
    r.push(14, `${components} components. With path compression + union by rank, each find is ~O(1) amortized.`, views(), { vars: { components }, done: true });
    return r.frames;
  },
};
