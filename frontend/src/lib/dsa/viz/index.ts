import type { VizSpec } from "../types";
import { binarySearch, greedy, intervals, monotonicStack, prefixSum, slidingWindow, twoPointers } from "./arrays";
import { backtracking, dp1d, dp2d } from "./dp";
import { graphTraversal, topologicalSort, unionFind } from "./graphs";
import { fastSlow, reversal, topK, treeBfs, treeDfs } from "./structures";

export const VIZ: Record<string, VizSpec> = {
  "two-pointers": twoPointers,
  "sliding-window": slidingWindow,
  "prefix-sum": prefixSum,
  "binary-search": binarySearch,
  "monotonic-stack": monotonicStack,
  intervals,
  greedy,
  "fast-slow-pointers": fastSlow,
  "linked-list-reversal": reversal,
  "top-k-heap": topK,
  "tree-bfs": treeBfs,
  "tree-dfs": treeDfs,
  "graph-traversal": graphTraversal,
  "topological-sort": topologicalSort,
  "union-find": unionFind,
  backtracking,
  "dp-1d": dp1d,
  "dp-2d": dp2d,
};
