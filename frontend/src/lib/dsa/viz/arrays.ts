import type { ArrayView, IntervalsView, Tone, VizSpec } from "../types";
import { num, nums, recorder, text } from "./helpers";

/* ───────────────────────── Two pointers ───────────────────────── */
export const twoPointers: VizSpec = {
  title: "Two Sum II — sorted input",
  problem: "Find two numbers in a sorted array that add up to the target. Return their indices.",
  code: `def two_sum_sorted(nums, target):
    left, right = 0, len(nums) - 1
    while left < right:
        total = nums[left] + nums[right]
        if total == target:
            return [left, right]
        if total < target:
            left += 1      # need a bigger sum
        else:
            right -= 1     # need a smaller sum
    return []`,
  inputs: [
    { key: "nums", label: "nums (sorted for you)", type: "numbers", default: "1, 3, 4, 6, 8, 11, 14, 17" },
    { key: "target", label: "target", type: "number", default: "17" },
  ],
  trace(inp) {
    const a = [...nums(inp.nums, [1, 3, 4, 6, 8, 11, 14, 17])].sort((x, y) => x - y);
    const target = num(inp.target, 17);
    const r = recorder();
    let l = 0;
    let h = a.length - 1;
    const view = (tones: Record<number, Tone> = {}): ArrayView => ({
      kind: "array",
      items: a,
      pointers: [
        { label: "L", index: l, tone: "info" },
        { label: "R", index: h, tone: "accent" },
      ],
      dim: a.map((_, i) => i).filter((i) => i < l || i > h),
      tones,
    });
    r.push(2, `Start with the smallest (L) and largest (R) values. Target = ${target}.`, [view()], { vars: { left: l, right: h, target } });
    while (l < h) {
      const total = a[l] + a[h];
      r.push(4, `${a[l]} + ${a[h]} = ${total}`, [view({ [l]: "info", [h]: "accent" })], { vars: { left: l, right: h, total, target } });
      if (total === target) {
        r.push(6, `Match! ${a[l]} + ${a[h]} = ${target}. Answer: [${l}, ${h}]`, [view({ [l]: "good", [h]: "good" })], { vars: { left: l, right: h, total, target }, done: true });
        return r.frames;
      }
      if (total < target) {
        r.push(8, `${total} < ${target}: too small. Every pair with L=${a[l]} is too small too (R is already the biggest left), so drop L.`, [view({ [l]: "weak" })], { vars: { left: l, right: h, total, target } });
        l++;
      } else {
        r.push(10, `${total} > ${target}: too big. Every pair with R=${a[h]} is too big too, so drop R.`, [view({ [h]: "weak" })], { vars: { left: l, right: h, total, target } });
        h--;
      }
    }
    r.push(11, "Pointers met — no pair adds up to the target.", [view()], { vars: { left: l, right: h, target }, done: true });
    return r.frames;
  },
};

/* ───────────────────────── Sliding window ───────────────────────── */
export const slidingWindow: VizSpec = {
  title: "Longest substring without repeating characters",
  problem: "Given a string, find the length of the longest substring with all-unique characters.",
  code: `def longest_unique(s):
    seen = {}            # char -> last index
    left = best = 0
    for right, ch in enumerate(s):
        if ch in seen and seen[ch] >= left:
            left = seen[ch] + 1   # jump past the duplicate
        seen[ch] = right
        best = max(best, right - left + 1)
    return best`,
  inputs: [{ key: "s", label: "s", type: "text", default: "abcabcbbxyz" }],
  trace(inp) {
    const s = text(inp.s, "abcabcbbxyz", 16);
    const chars = s.split("");
    const r = recorder();
    const seen = new Map<string, number>();
    let left = 0;
    let best = 0;
    let bestRange: [number, number] | null = null;
    const view = (right: number, tones: Record<number, Tone> = {}): ArrayView => ({
      kind: "array",
      items: chars,
      pointers: right >= 0 ? [
        { label: "L", index: left, tone: "info" },
        { label: "R", index: right, tone: "accent" },
      ] : [],
      window: right >= left && right >= 0 ? [left, right] : undefined,
      windowTone: "good",
      tones,
    });
    const aux = (hi?: string) => [
      {
        label: "seen (char → last index)",
        kind: "map" as const,
        items: [...seen.entries()] as [string, number][],
        highlight: hi ? [[...seen.keys()].indexOf(hi)] : [],
        empty: "{}",
      },
    ];
    r.push(3, "Window is empty. It will only ever grow on the right and shrink on the left.", [view(-1)], { aux: aux(), vars: { left, best } });
    for (let right = 0; right < chars.length; right++) {
      const ch = chars[right];
      if (seen.has(ch) && seen.get(ch)! >= left) {
        const prev = seen.get(ch)!;
        r.push(5, `'${ch}' is already inside the window (at ${prev}). Duplicate!`, [view(right, { [right]: "weak", [prev]: "weak" })], { aux: aux(ch), vars: { left, right, best } });
        left = prev + 1;
        r.push(6, `Slide L to ${left} — just past the old '${ch}'. No need to re-check anything in between.`, [view(right, { [right]: "accent" })], { aux: aux(ch), vars: { left, right, best } });
      }
      seen.set(ch, right);
      r.push(7, `Remember '${ch}' was last seen at ${right}.`, [view(right, { [right]: "accent" })], { aux: aux(ch), vars: { left, right, best } });
      const len = right - left + 1;
      if (len > best) {
        best = len;
        bestRange = [left, right];
      }
      r.push(8, `Window "${chars.slice(left, right + 1).join("")}" has length ${len}. Best so far: ${best}.`, [view(right)], { aux: aux(), vars: { left, right, best } });
    }
    const tones: Record<number, Tone> = {};
    if (bestRange) for (let i = bestRange[0]; i <= bestRange[1]; i++) tones[i] = "good";
    r.push(9, `Done. Longest unique substring has length ${best}${bestRange ? ` ("${chars.slice(bestRange[0], bestRange[1] + 1).join("")}")` : ""}.`, [{ kind: "array", items: chars, tones }], { aux: aux(), vars: { best }, done: true });
    return r.frames;
  },
};

/* ───────────────────────── Prefix sum + hash map ───────────────────────── */
export const prefixSum: VizSpec = {
  title: "Subarray sum equals k",
  problem: "Count the contiguous subarrays whose sum is exactly k (numbers may be negative).",
  code: `def subarray_sum(nums, k):
    count = 0
    prefix = 0
    seen = {0: 1}        # prefix sum -> times seen
    for x in nums:
        prefix += x
        count += seen.get(prefix - k, 0)
        seen[prefix] = seen.get(prefix, 0) + 1
    return count`,
  inputs: [
    { key: "nums", label: "nums", type: "numbers", default: "3, 4, -7, 1, 3, 3, 1, -4" },
    { key: "k", label: "k", type: "number", default: "7" },
  ],
  trace(inp) {
    const a = nums(inp.nums, [3, 4, -7, 1, 3, 3, 1, -4]);
    const k = num(inp.k, 7);
    const r = recorder();
    const seen = new Map<number, number>([[0, 1]]);
    const positions = new Map<number, number[]>([[0, [-1]]]);
    const prefixes: (number | null)[] = a.map(() => null);
    let prefix = 0;
    let count = 0;
    const view = (i: number, tones: Record<number, Tone> = {}, window?: [number, number]): ArrayView => ({
      kind: "array",
      items: a,
      pointers: i >= 0 ? [{ label: "i", index: i, tone: "accent" }] : [],
      sub: prefixes,
      subLabel: "prefix",
      tones,
      window,
      windowTone: "good",
    });
    const aux = (hi?: number) => [
      { label: "seen (prefix → count)", kind: "map" as const, items: [...seen.entries()] as [number, number][], highlight: hi !== undefined ? [[...seen.keys()].indexOf(hi)] : [] },
    ];
    r.push(4, `Seed seen with {0: 1}: "an empty prefix with sum 0 exists". That lets a subarray starting at index 0 count.`, [view(-1)], { aux: aux(0), vars: { prefix, count, k } });
    for (let i = 0; i < a.length; i++) {
      prefix += a[i];
      prefixes[i] = prefix;
      r.push(6, `prefix = sum(nums[0..${i}]) = ${prefix}`, [view(i, { [i]: "accent" })], { aux: aux(), vars: { prefix, count, k } });
      const need = prefix - k;
      const hits = seen.get(need) ?? 0;
      if (hits > 0) {
        const start = (positions.get(need) ?? [])[0] + 1;
        count += hits;
        r.push(7, `Need an earlier prefix of ${prefix} − ${k} = ${need}. Seen ${hits}× → ${hits} subarray(s) ending here sum to ${k}, e.g. [${start}..${i}].`, [view(i, {}, [start, i])], { aux: aux(need), vars: { prefix, need, count, k } });
      } else {
        r.push(7, `Need an earlier prefix of ${prefix} − ${k} = ${need}. Not seen yet → nothing ends here.`, [view(i, { [i]: "accent" })], { aux: aux(), vars: { prefix, need, count, k } });
      }
      seen.set(prefix, (seen.get(prefix) ?? 0) + 1);
      positions.set(prefix, [...(positions.get(prefix) ?? []), i]);
      r.push(8, `Record prefix ${prefix} so later indices can use it.`, [view(i)], { aux: aux(prefix), vars: { prefix, count, k } });
    }
    r.push(9, `Done. ${count} subarray(s) sum to ${k} — found in one pass instead of checking every (start, end) pair.`, [view(-1)], { aux: aux(), vars: { count }, done: true });
    return r.frames;
  },
};

/* ───────────────────────── Binary search ───────────────────────── */
export const binarySearch: VizSpec = {
  title: "Binary search in a sorted array",
  problem: "Return the index of target in a sorted array, or -1 if it isn't there.",
  code: `def search(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1     # answer is right of mid
        else:
            hi = mid - 1     # answer is left of mid
    return -1`,
  inputs: [
    { key: "nums", label: "nums (sorted for you)", type: "numbers", default: "2, 5, 8, 12, 16, 23, 38, 56, 72, 91" },
    { key: "target", label: "target", type: "number", default: "23" },
  ],
  trace(inp) {
    const a = [...nums(inp.nums, [2, 5, 8, 12, 16, 23, 38, 56, 72, 91], 16)].sort((x, y) => x - y);
    const target = num(inp.target, 23);
    const r = recorder();
    let lo = 0;
    let hi = a.length - 1;
    const view = (mid?: number, tones: Record<number, Tone> = {}): ArrayView => ({
      kind: "array",
      items: a,
      pointers: [
        { label: "lo", index: lo, tone: "info" as Tone },
        { label: "hi", index: hi, tone: "violet" as Tone },
        ...(mid !== undefined ? [{ label: "mid", index: mid, tone: "accent" as Tone }] : []),
      ].filter((p) => p.index >= 0 && p.index < a.length),
      dim: a.map((_, i) => i).filter((i) => i < lo || i > hi),
      tones,
    });
    r.push(2, `Search space is the whole array: ${a.length} candidates.`, [view()], { vars: { lo, hi, target } });
    let steps = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      steps++;
      r.push(4, `mid = (${lo} + ${hi}) // 2 = ${mid}, nums[mid] = ${a[mid]}`, [view(mid, { [mid]: "accent" })], { vars: { lo, hi, mid, target } });
      if (a[mid] === target) {
        r.push(6, `Found ${target} at index ${mid} after ${steps} probe(s). Linear scan could take ${a.length}.`, [view(mid, { [mid]: "good" })], { vars: { lo, hi, mid, target }, done: true });
        return r.frames;
      }
      if (a[mid] < target) {
        r.push(8, `${a[mid]} < ${target}: everything at or left of mid is too small. Throw away the left half.`, [view(mid, { [mid]: "weak" })], { vars: { lo, hi, mid, target } });
        lo = mid + 1;
      } else {
        r.push(10, `${a[mid]} > ${target}: everything at or right of mid is too big. Throw away the right half.`, [view(mid, { [mid]: "weak" })], { vars: { lo, hi, mid, target } });
        hi = mid - 1;
      }
      r.push(3, `${Math.max(0, hi - lo + 1)} candidate(s) left.`, [view()], { vars: { lo, hi, target } });
    }
    r.push(11, `lo passed hi — ${target} is not in the array.`, [view()], { vars: { lo, hi, target }, done: true });
    return r.frames;
  },
};

/* ───────────────────────── Monotonic stack ───────────────────────── */
export const monotonicStack: VizSpec = {
  title: "Daily temperatures",
  problem: "For each day, how many days until a warmer temperature? 0 if never.",
  code: `def daily_temperatures(temps):
    answer = [0] * len(temps)
    stack = []               # indices; temps decreasing
    for i, t in enumerate(temps):
        while stack and temps[stack[-1]] < t:
            j = stack.pop()
            answer[j] = i - j    # i is j's next warmer day
        stack.append(i)
    return answer`,
  inputs: [{ key: "temps", label: "temps", type: "numbers", default: "73, 74, 75, 71, 69, 72, 76, 73" }],
  trace(inp) {
    const t = nums(inp.temps, [73, 74, 75, 71, 69, 72, 76, 73]);
    const r = recorder();
    const answer: (number | null)[] = t.map(() => null);
    const stack: number[] = [];
    const view = (i: number, tones: Record<number, Tone> = {}): ArrayView => ({
      kind: "array",
      items: t,
      pointers: i >= 0 && i < t.length ? [{ label: "i", index: i, tone: "accent" }] : [],
      sub: answer,
      subLabel: "answer",
      tones: { ...Object.fromEntries(stack.map((s) => [s, "info" as Tone])), ...tones },
    });
    const aux = (hi?: number) => [
      { label: "stack (waiting for a warmer day)", kind: "stack" as const, items: stack.map((s) => `${t[s]} @${s}`), highlight: hi !== undefined ? [hi] : [], empty: "empty" },
    ];
    r.push(3, "The stack holds days still waiting for a warmer day. Their temps are always decreasing bottom → top.", [view(-1)], { aux: aux() });
    for (let i = 0; i < t.length; i++) {
      r.push(4, `Day ${i}: ${t[i]}°`, [view(i, { [i]: "accent" })], { aux: aux(), vars: { i, t: t[i] } });
      while (stack.length && t[stack[stack.length - 1]] < t[i]) {
        const j = stack[stack.length - 1];
        r.push(5, `${t[i]}° beats day ${j} (${t[j]}°) on top of the stack.`, [view(i, { [i]: "accent", [j]: "good" })], { aux: aux(stack.length - 1), vars: { i, t: t[i], top: j } });
        stack.pop();
        answer[j] = i - j;
        r.push(7, `Pop day ${j}: its answer is ${i} − ${j} = ${i - j}. It never needs to be looked at again.`, [view(i, { [i]: "accent", [j]: "good" })], { aux: aux(), vars: { i, j } });
      }
      stack.push(i);
      r.push(8, `Push day ${i}; it waits for something warmer than ${t[i]}°.`, [view(i, { [i]: "accent" })], { aux: aux(stack.length - 1), vars: { i } });
    }
    for (const s of stack) answer[s] = 0;
    r.push(9, "Whatever is still on the stack never got a warmer day → 0. Each index was pushed and popped at most once: O(n).", [view(-1)], { aux: aux(), done: true });
    return r.frames;
  },
};

/* ───────────────────────── Merge intervals ───────────────────────── */
export const intervals: VizSpec = {
  title: "Merge overlapping intervals",
  problem: "Merge all overlapping intervals and return the non-overlapping result.",
  code: `def merge(intervals):
    intervals.sort(key=lambda iv: iv[0])
    merged = [intervals[0]]
    for start, end in intervals[1:]:
        last = merged[-1]
        if start <= last[1]:              # overlaps
            last[1] = max(last[1], end)   # stretch it
        else:
            merged.append([start, end])   # gap: new block
    return merged`,
  inputs: [{ key: "ivs", label: "intervals (start,end pairs)", type: "numbers", default: "8,10, 1,3, 15,18, 2,6, 9,12, 17,20" }],
  trace(inp) {
    const flat = nums(inp.ivs, [8, 10, 1, 3, 15, 18, 2, 6, 9, 12, 17, 20], 16);
    const raw: [number, number][] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) raw.push([Math.min(flat[i], flat[i + 1]), Math.max(flat[i], flat[i + 1])]);
    if (!raw.length) raw.push([1, 3]);
    const r = recorder();
    const min = Math.min(...raw.map((x) => x[0]));
    const max = Math.max(...raw.map((x) => x[1]));
    const view = (list: [number, number][], cur: number, merged: [number, number][], mergedHi: number | null, curTone: Tone = "accent"): IntervalsView => ({
      kind: "intervals",
      min,
      max,
      rows: [
        ...list.map((iv, i) => ({
          label: `[${iv[0]},${iv[1]}]`,
          items: [{ range: iv, tone: i === cur ? curTone : i < cur ? ("muted" as Tone) : ("info" as Tone), dim: i < cur }],
        })),
        { label: "merged", items: merged.map((m, i) => ({ range: m, tone: (i === mergedHi ? "good" : "violet") as Tone })) },
      ],
    });
    r.push(1, "Unsorted, overlaps are hard to see — they could be anywhere.", [view(raw, -1, [], null)]);
    const s = [...raw].sort((x, y) => x[0] - y[0]);
    const merged: [number, number][] = [[...s[0]]];
    r.push(2, "Sort by start. Now anything that overlaps the current block must come right after it.", [view(s, -1, [], null)]);
    r.push(3, `Start the result with [${s[0][0]},${s[0][1]}].`, [view(s, 0, merged, 0)]);
    for (let i = 1; i < s.length; i++) {
      const [st, en] = s[i];
      const last = merged[merged.length - 1];
      if (st <= last[1]) {
        r.push(6, `[${st},${en}] starts at ${st} ≤ ${last[1]} (end of last block) → overlap.`, [view(s, i, merged, merged.length - 1, "okay")], { vars: { start: st, end: en, "last.end": last[1] } });
        const prevEnd = last[1];
        last[1] = Math.max(last[1], en);
        r.push(7, `Stretch the last block to end at max(${prevEnd}, ${en}) = ${last[1]}.`, [view(s, i, merged, merged.length - 1, "good")], { vars: { "last.end": last[1] } });
      } else {
        merged.push([st, en]);
        r.push(9, `${st} > ${last[1]}: there's a gap. Start a new block [${st},${en}].`, [view(s, i, merged, merged.length - 1)], { vars: { start: st, end: en } });
      }
    }
    r.push(10, `Done: ${merged.map((m) => `[${m[0]},${m[1]}]`).join(" ")}. Sorting costs O(n log n); the sweep is O(n).`, [view(s, s.length, merged, null)], { done: true });
    return r.frames;
  },
};

/* ───────────────────────── Greedy ───────────────────────── */
export const greedy: VizSpec = {
  title: "Jump game — track the farthest reach",
  problem: "nums[i] is the max jump from index i. Can you reach the last index from index 0?",
  code: `def can_jump(nums):
    reach = 0                        # farthest index reachable so far
    for i, step in enumerate(nums):
        if i > reach:
            return False             # stuck: can't even get to i
        reach = max(reach, i + step)
        if reach >= len(nums) - 1:
            return True
    return True`,
  inputs: [{ key: "nums", label: "nums", type: "numbers", default: "2, 3, 1, 1, 4, 0, 1, 2", hint: "Try 3, 2, 1, 0, 4 to see it get stuck." }],
  trace(inp) {
    const a = nums(inp.nums, [2, 3, 1, 1, 4, 0, 1, 2]).map((x) => Math.max(0, x));
    const r = recorder();
    let reach = 0;
    const view = (i: number, tones: Record<number, Tone> = {}): ArrayView => ({
      kind: "array",
      items: a,
      pointers: i >= 0 ? [{ label: "i", index: i, tone: "accent" }] : [],
      window: [0, Math.min(reach, a.length - 1)],
      windowTone: "good",
      tones,
      dim: a.map((_, k) => k).filter((k) => k > reach),
    });
    r.push(2, "Green bracket = every index we can certainly stand on. It starts as just index 0.", [view(-1)], { vars: { reach } });
    for (let i = 0; i < a.length; i++) {
      if (i > reach) {
        r.push(5, `Index ${i} is beyond the farthest reach (${reach}). We're stuck → False.`, [view(i, { [i]: "weak" })], { vars: { i, reach }, done: true });
        return r.frames;
      }
      const before = reach;
      reach = Math.max(reach, i + a[i]);
      r.push(6, `From ${i} we can jump up to ${i} + ${a[i]} = ${i + a[i]}. Reach: ${before} → ${reach}.`, [view(i, { [i]: "accent" })], { vars: { i, step: a[i], reach } });
      if (reach >= a.length - 1) {
        r.push(8, `Reach ${reach} covers the last index (${a.length - 1}) → True. We never had to try specific jump sequences.`, [view(i, { [a.length - 1]: "good" })], { vars: { reach }, done: true });
        return r.frames;
      }
    }
    r.push(9, "Reached the end.", [view(-1)], { vars: { reach }, done: true });
    return r.frames;
  },
};
