import type { ArrayView, GraphEdge, GraphNode, GraphView, Tone, VizSpec } from "../types";
import { heapTree, layoutTree, num, nums, recorder } from "./helpers";

/* ───────────────────────── Fast & slow pointers ───────────────────────── */
export const fastSlow: VizSpec = {
  title: "Floyd's cycle detection",
  problem: "Does this linked list loop back on itself? Use O(1) extra memory.",
  code: `def has_cycle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next          # 1 step
        fast = fast.next.next     # 2 steps
        if slow is fast:
            return True           # they met inside the loop
    return False`,
  inputs: [
    { key: "vals", label: "node values", type: "numbers", default: "3, 1, 4, 1, 5, 9, 2, 6" },
    { key: "pos", label: "tail links to index (-1 = no cycle)", type: "number", default: "2" },
  ],
  trace(inp) {
    const vals = nums(inp.vals, [3, 1, 4, 1, 5, 9, 2, 6], 10);
    const n = vals.length;
    let pos = num(inp.pos, 2);
    if (pos >= n || pos < -1) pos = -1;
    const nodes: GraphNode[] = [];
    let width: number;
    let height: number;
    if (pos < 0) {
      width = Math.max(320, 70 * n + 40);
      height = 110;
      vals.forEach((v, i) => nodes.push({ id: String(i), x: 40 + i * 70, y: 55, label: v }));
    } else {
      const c = n - pos;
      const R = Math.max(52, (c * 68) / (2 * Math.PI));
      const cy = R + 34;
      const tailEnd = 36 + pos * 70;
      const cx = tailEnd + R;
      width = cx + R + 40;
      height = cy + R + 34;
      for (let i = 0; i < pos; i++) nodes.push({ id: String(i), x: 36 + i * 70, y: cy, label: vals[i] });
      for (let k = 0; k < c; k++) {
        const th = Math.PI - (2 * Math.PI * k) / c;
        nodes.push({ id: String(pos + k), x: cx + R * Math.cos(th), y: cy - R * Math.sin(th), label: vals[pos + k] });
      }
    }
    const edges: GraphEdge[] = [];
    for (let i = 0; i < n - 1; i++) edges.push({ from: String(i), to: String(i + 1), directed: true });
    if (pos >= 0) edges.push({ from: String(n - 1), to: String(pos), directed: true, tone: "okay" });
    const next = (i: number | null): number | null => (i === null ? null : i < n - 1 ? i + 1 : pos >= 0 ? pos : null);

    const r = recorder();
    let slow: number | null = 0;
    let fast: number | null = 0;
    const view = (tones: Record<string, Tone> = {}): GraphView => ({
      kind: "graph",
      width,
      height,
      nodes,
      edges,
      tones,
      pointers: [
        ...(slow !== null ? [{ label: "slow", node: String(slow), tone: "info" as Tone }] : []),
        ...(fast !== null ? [{ label: "fast", node: String(fast), tone: "accent" as Tone }] : []),
      ],
    });
    r.push(2, "Both runners start at the head. Slow takes 1 step per turn, fast takes 2.", [view()], { vars: { slow: 0, fast: 0 } });
    let steps = 0;
    while (fast !== null && next(fast) !== null) {
      slow = next(slow);
      r.push(4, `Slow moves 1 → node ${slow}.`, [view({ [String(slow)]: "info" })], { vars: { slow, fast } });
      fast = next(next(fast));
      steps++;
      r.push(5, `Fast moves 2 → node ${fast ?? "None"}.`, [view(fast !== null ? { [String(fast)]: "accent" } : {})], { vars: { slow, fast: fast ?? "None", step: steps } });
      if (slow === fast) {
        r.push(7, `They meet at node ${slow}. Inside a loop, fast gains 1 node per turn on slow, so it must catch it — cycle found.`, [view({ [String(slow)]: "good" })], { vars: { slow, fast }, done: true });
        return r.frames;
      }
    }
    r.push(8, "Fast fell off the end of the list — a list with a loop has no end, so there is no cycle.", [view()], { vars: { slow, fast: fast ?? "None" }, done: true });
    return r.frames;
  },
};

/* ───────────────────────── In-place reversal ───────────────────────── */
export const reversal: VizSpec = {
  title: "Reverse a linked list in place",
  problem: "Reverse a singly linked list by re-pointing each node's next — no new nodes.",
  code: `def reverse_list(head):
    prev = None
    curr = head
    while curr:
        nxt = curr.next      # remember the rest
        curr.next = prev     # flip the arrow
        prev = curr          # step prev forward
        curr = nxt           # step curr forward
    return prev`,
  inputs: [{ key: "vals", label: "node values", type: "numbers", default: "1, 2, 3, 4, 5" }],
  trace(inp) {
    const vals = nums(inp.vals, [1, 2, 3, 4, 5], 8);
    const n = vals.length;
    const gap = 78;
    const nodes: GraphNode[] = [
      { id: "nl", x: 30, y: 60, label: "∅", ghost: true },
      ...vals.map((v, i) => ({ id: String(i), x: 30 + gap * (i + 1), y: 60, label: v })),
      { id: "nr", x: 30 + gap * (n + 1), y: 60, label: "∅", ghost: true },
    ];
    const nextOf: string[] = vals.map((_, i) => (i < n - 1 ? String(i + 1) : "nr"));
    const flipped: boolean[] = vals.map(() => false);
    const r = recorder();
    let prev = "nl";
    let curr: string = n ? "0" : "nr";
    let nxt: string | null = null;
    const view = (tones: Record<string, Tone> = {}, hiEdge?: number): GraphView => ({
      kind: "graph",
      width: 60 + gap * (n + 1),
      height: 130,
      nodes,
      edges: nextOf.map((to, i) => ({
        from: String(i),
        to,
        directed: true,
        tone: i === hiEdge ? "accent" : flipped[i] ? "good" : undefined,
        curve: flipped[i] ? 0.28 : 0,
      })),
      tones,
      pointers: [
        { label: "prev", node: prev, tone: "good", below: true },
        { label: "curr", node: curr, tone: "accent", below: true },
        ...(nxt !== null ? [{ label: "nxt", node: nxt, tone: "info" as Tone, below: true }] : []),
      ],
    });
    const lbl = (id: string | null) => (id === null ? "—" : id === "nl" || id === "nr" ? "None" : String(vals[Number(id)]));
    r.push(3, "prev starts at None, curr at the head. Every arrow currently points right.", [view()], { vars: { prev: "None", curr: lbl(curr) } });
    while (curr !== "nr") {
      const i = Number(curr);
      nxt = nextOf[i];
      r.push(5, `Save nxt = ${lbl(nxt)} — once we flip ${vals[i]}'s arrow we'd lose the rest of the list.`, [view({ [curr]: "accent" })], { vars: { prev: lbl(prev), curr: lbl(curr), nxt: lbl(nxt) } });
      nextOf[i] = prev;
      flipped[i] = true;
      r.push(6, `Flip: ${vals[i]}.next = ${lbl(prev)}.`, [view({ [curr]: "accent" }, i)], { vars: { prev: lbl(prev), curr: lbl(curr), nxt: lbl(nxt) } });
      prev = curr;
      r.push(7, `prev steps to ${lbl(prev)}.`, [view()], { vars: { prev: lbl(prev), curr: lbl(curr), nxt: lbl(nxt) } });
      curr = nxt;
      r.push(8, `curr steps to ${lbl(curr)}.`, [view()], { vars: { prev: lbl(prev), curr: lbl(curr), nxt: lbl(nxt) } });
      nxt = null;
    }
    r.push(9, `curr is None, so prev (${lbl(prev)}) is the new head. O(n) time, O(1) extra space.`, [view({ [prev]: "good" })], { vars: { head: lbl(prev) }, done: true });
    return r.frames;
  },
};

const ord = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 >= 11 && n % 100 <= 13 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

/* ───────────────────────── Heap / Top-K ───────────────────────── */
export const topK: VizSpec = {
  title: "Kth largest with a size-k min-heap",
  problem: "Find the kth largest number. Keep only the k biggest seen so far.",
  code: `import heapq
def kth_largest(nums, k):
    heap = []                      # min-heap of the k largest so far
    for x in nums:
        heapq.heappush(heap, x)
        if len(heap) > k:
            heapq.heappop(heap)    # evict the smallest
    return heap[0]                 # smallest of the top k`,
  inputs: [
    { key: "nums", label: "nums", type: "numbers", default: "7, 2, 9, 4, 11, 1, 8, 5" },
    { key: "k", label: "k", type: "number", default: "3" },
  ],
  trace(inp) {
    const a = nums(inp.nums, [7, 2, 9, 4, 11, 1, 8, 5], 12);
    const k = Math.max(1, Math.min(num(inp.k, 3), a.length));
    const heap: number[] = [];
    const r = recorder();
    const siftUp = (i: number) => {
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p] <= heap[i]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const siftDown = (i: number) => {
      for (;;) {
        const l = 2 * i + 1;
        const rr = l + 1;
        let m = i;
        if (l < heap.length && heap[l] < heap[m]) m = l;
        if (rr < heap.length && heap[rr] < heap[m]) m = rr;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    };
    const views = (i: number, heapTones: Record<string, Tone> = {}, arrTones: Record<number, Tone> = {}) => {
      const t = heapTree(heap, 380);
      const arr: ArrayView = { kind: "array", title: "nums", items: a, pointers: i >= 0 ? [{ label: "x", index: i, tone: "accent" }] : [], tones: arrTones, dim: a.map((_, j) => j).filter((j) => j < i) };
      const g: GraphView = { kind: "graph", title: `min-heap (size ≤ ${k}) — root is the smallest`, width: 380, height: Math.max(t.height, 70), nodes: t.nodes, edges: t.edges, tones: { "0": "okay", ...heapTones } };
      return [arr, g];
    };
    r.push(3, `Keep a min-heap of at most k=${k} items. Its root is "the weakest of the strongest".`, views(-1), { vars: { k } });
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      heap.push(x);
      siftUp(heap.length - 1);
      const at = heap.indexOf(x);
      r.push(5, `Push ${x}. The heap bubbles it up until its parent is smaller.`, views(i, { [String(at)]: "accent" }, { [i]: "accent" }), { vars: { x, size: heap.length, k } });
      if (heap.length > k) {
        const out = heap[0];
        heap[0] = heap[heap.length - 1];
        heap.pop();
        siftDown(0);
        r.push(7, `Size ${k + 1} > k: evict the root ${out}. It can't be in the top ${k} because ${k} bigger numbers exist.`, views(i, {}, { [i]: "accent" }), { vars: { evicted: out, size: heap.length, k } });
      }
    }
    r.push(8, `All numbers seen. The heap holds the ${k} largest; its root ${heap[0]} is the ${ord(k)} largest. O(n log k) time, O(k) space.`, views(a.length, { "0": "good" }), { vars: { answer: heap[0] }, done: true });
    return r.frames;
  },
};

/* ───────────────────────── Tree BFS ───────────────────────── */
const TREE = [8, 3, 10, 1, 6, null, 14, null, null, 4, 7, 13];

export const treeBfs: VizSpec = {
  title: "Level-order traversal",
  problem: "Return the tree's values level by level, top to bottom.",
  code: `from collections import deque
def level_order(root):
    result, queue = [], deque([root])
    while queue:
        level = []
        for _ in range(len(queue)):   # exactly one level
            node = queue.popleft()
            level.append(node.val)
            for child in (node.left, node.right):
                if child: queue.append(child)
        result.append(level)
    return result`,
  trace() {
    const t = layoutTree(TREE, 520);
    const r = recorder();
    const queue: number[] = [0];
    const visited = new Set<number>();
    const result: string[] = [];
    let level: number[] = [];
    const val = (i: number) => TREE[i] as number;
    const view = (cur?: number): GraphView => {
      const tones: Record<string, Tone> = {};
      visited.forEach((v) => (tones[String(v)] = "good"));
      queue.forEach((q) => (tones[String(q)] = "info"));
      if (cur !== undefined) tones[String(cur)] = "accent";
      return { kind: "graph", width: 520, height: t.height, nodes: t.nodes, edges: t.edges, tones };
    };
    const aux = () => [
      { label: "queue (front → back)", kind: "queue" as const, items: queue.map(val), empty: "empty" },
      { label: "level", kind: "list" as const, items: level, empty: "[]" },
      { label: "result", kind: "list" as const, items: result, empty: "[]" },
    ];
    r.push(3, "Start with just the root in the queue. Blue = waiting in queue, green = done.", [view()], { aux: aux() });
    while (queue.length) {
      const size = queue.length;
      level = [];
      r.push(6, `The queue holds exactly one level right now: ${size} node(s). Process that many.`, [view()], { aux: aux(), vars: { level_size: size } });
      for (let s = 0; s < size; s++) {
        const node = queue.shift()!;
        level.push(val(node));
        r.push(8, `Pop ${val(node)} from the front and record it.`, [view(node)], { aux: aux(), vars: { node: val(node) } });
        const kids = [t.left[node], t.right[node]].filter((c): c is number => c !== null);
        for (const c of kids) queue.push(c);
        visited.add(node);
        if (kids.length) r.push(10, `Enqueue its children ${kids.map(val).join(", ")} at the back — they're the next level.`, [view(node)], { aux: aux(), vars: { node: val(node) } });
      }
      result.push(`[${level.join(",")}]`);
      r.push(11, `Level finished: [${level.join(", ")}].`, [view()], { aux: aux() });
    }
    r.push(12, "Queue empty — every node visited once, level by level. O(n) time, O(width) space.", [view()], { aux: aux(), done: true });
    return r.frames;
  },
};

/* ───────────────────────── Tree DFS ───────────────────────── */
export const treeDfs: VizSpec = {
  title: "Max depth — answers flow back up",
  problem: "Return the number of nodes on the longest root-to-leaf path.",
  code: `def max_depth(node):
    if not node:
        return 0
    left = max_depth(node.left)
    right = max_depth(node.right)
    return 1 + max(left, right)`,
  trace() {
    const t = layoutTree(TREE, 520);
    const r = recorder();
    const result: Record<number, number> = {};
    const stack: number[] = [];
    const val = (i: number) => TREE[i] as number;
    const view = (cur?: number, tone: Tone = "accent"): GraphView => {
      const tones: Record<string, Tone> = {};
      Object.keys(result).forEach((k) => (tones[k] = "good"));
      stack.forEach((s) => (tones[String(s)] = "info"));
      if (cur !== undefined) tones[String(cur)] = tone;
      return {
        kind: "graph",
        width: 520,
        height: t.height + 14,
        nodes: t.nodes.map((n) => ({ ...n, sub: result[Number(n.id)] !== undefined ? `d=${result[Number(n.id)]}` : undefined })),
        edges: t.edges,
        tones,
      };
    };
    const aux = () => [{ label: "call stack (bottom → top)", kind: "stack" as const, items: stack.map((s) => `max_depth(${val(s)})`), empty: "empty" }];
    const go = (n: number | null): number => {
      if (n === null) return 0;
      stack.push(n);
      r.push(2, `Call max_depth(${val(n)}). Can't answer yet — first ask both children.`, [view(n)], { aux: aux(), vars: { node: val(n) } });
      if (t.left[n] === null) r.push(4, `${val(n)} has no left child → that side returns 0.`, [view(n)], { aux: aux(), vars: { node: val(n), left: 0 } });
      const L = go(t.left[n]);
      if (t.left[n] !== null) r.push(4, `Back in ${val(n)}: left subtree depth = ${L}.`, [view(n)], { aux: aux(), vars: { node: val(n), left: L } });
      if (t.right[n] === null) r.push(5, `${val(n)} has no right child → that side returns 0.`, [view(n)], { aux: aux(), vars: { node: val(n), left: L, right: 0 } });
      const R = go(t.right[n]);
      if (t.right[n] !== null) r.push(5, `Back in ${val(n)}: right subtree depth = ${R}.`, [view(n)], { aux: aux(), vars: { node: val(n), left: L, right: R } });
      const d = 1 + Math.max(L, R);
      result[n] = d;
      stack.pop();
      r.push(6, `${val(n)} returns 1 + max(${L}, ${R}) = ${d}.`, [view(n, "good")], { aux: aux(), vars: { node: val(n), left: L, right: R, returns: d } });
      return d;
    };
    const ans = go(0);
    r.push(6, `The root's answer is ${ans}. Each node did O(1) work after its children replied → O(n) total, O(height) stack.`, [view(0, "good")], { aux: aux(), vars: { answer: ans }, done: true });
    return r.frames;
  },
};
