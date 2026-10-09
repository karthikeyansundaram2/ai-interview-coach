import type { PatternContent } from "@/lib/dsa/content-types";

export const PATTERNS: PatternContent[] = [
  // ───────────────────────────── 1. Two Pointers ─────────────────────────────
  {
    slug: "two-pointers",
    name: "Two Pointers",
    category: "Arrays & Strings",
    tagline: "Two indices squeeze inward so every pair never gets checked.",
    analogy:
      "Two friends start at opposite ends of a bookshelf sorted by thickness, looking for two books that together fill a gap exactly. If the pair is too thick, the friend on the thick end steps inward; too thin, the friend on the thin end steps inward. They meet in the middle having looked at each book only once.",
    insight:
      "Brute force tries all `n²` pairs. On a **sorted** array, one comparison tells you which side is wrong: if `nums[l] + nums[r]` is too big, *every* pair using `r` with anything right of `l` is also too big, so `r` can be thrown away for good. Each step discards a whole row or column of the pair grid, so you finish in `O(n)`.",
    cues: [
      "sorted array",
      "find a pair (or triplet) that sums to target",
      "in-place, O(1) extra space",
      "palindrome / compare from both ends",
      "remove duplicates or move elements in place",
      "maximize area between two lines",
    ],
    steps: [
      "Make sure the input is sorted (sort it if order doesn't matter to the answer).",
      "Place `l = 0` and `r = n - 1` (or two pointers moving the same direction for in-place rewrites).",
      "Compute something from `nums[l]` and `nums[r]` and compare it to the goal.",
      "Move exactly the pointer whose side can't possibly be part of a better answer.",
      "Stop when the pointers cross; for k-sum, fix one element and run two pointers on the rest.",
    ],
    complexity: {
      brute: "O(n²) — check every pair",
      pattern: "O(n) — each pointer moves at most n times (plus O(n log n) if you must sort)",
      space: "O(1)",
    },
    variations: [
      {
        name: "Opposite ends (Two Sum II)",
        note: "Classic converging pointers on a sorted array — what the visualizer animates.",
        code: `def two_sum(numbers: list[int], target: int) -> list[int]:
    l, r = 0, len(numbers) - 1
    while l < r:
        s = numbers[l] + numbers[r]
        if s == target:
            return [l + 1, r + 1]
        if s < target:
            l += 1      # need bigger sum
        else:
            r -= 1      # need smaller sum
    return []`,
      },
      {
        name: "3Sum (fix one + two pointers)",
        note: "Sort, loop `i`, then run the converging pair on `i+1..n-1`. Skip duplicate values to avoid repeated triplets.",
        code: `def three_sum(nums: list[int]) -> list[list[int]]:
    nums.sort()
    res = []
    for i in range(len(nums) - 2):
        if i and nums[i] == nums[i - 1]:
            continue
        l, r = i + 1, len(nums) - 1
        while l < r:
            s = nums[i] + nums[l] + nums[r]
            if s < 0:
                l += 1
            elif s > 0:
                r -= 1
            else:
                res.append([nums[i], nums[l], nums[r]])
                l += 1
                while l < r and nums[l] == nums[l - 1]:
                    l += 1
    return res`,
      },
      {
        name: "Same direction (read/write pointers)",
        note: "A slow `write` pointer and a fast `read` pointer compact an array in place (Move Zeroes, Remove Duplicates).",
      },
      {
        name: "Greedy shrink (Container With Most Water)",
        note: "Not sorted, but you always move the shorter wall because the taller one can never help it.",
      },
    ],
    mistakes: [
      "Using `l <= r` and pairing an element with itself.",
      "Applying it to an unsorted array where moving a pointer gives no information.",
      "In 3Sum, forgetting to skip duplicates for both `i` and `l`, producing repeated triplets.",
      "Moving both pointers after a match when only one should move (or vice versa) and missing answers.",
      "Returning 0-based indices when the problem asks for 1-based (Two Sum II).",
    ],
    problems: [
      { title: "Valid Palindrome", lc: "valid-palindrome", level: "Easy", hint: "Compare characters from both ends, skipping non-alphanumerics.", companies: ["Meta", "Microsoft", "Amazon"] },
      { title: "Move Zeroes", lc: "move-zeroes", level: "Easy", hint: "One pointer reads, another marks where the next non-zero goes.", companies: ["Meta", "Amazon", "Apple"] },
      { title: "Squares of a Sorted Array", lc: "squares-of-a-sorted-array", level: "Easy", hint: "The biggest square is always at one of the two ends.", companies: ["Amazon", "Google"] },
      { title: "Two Sum II - Input Array Is Sorted", lc: "two-sum-ii-input-array-is-sorted", level: "Medium", hint: "Sum too big? Only one pointer can fix that.", companies: ["Amazon", "Google", "Meta"] },
      { title: "3Sum", lc: "3sum", level: "Medium", hint: "Fix one number, then it's Two Sum II on the rest.", companies: ["Meta", "Amazon", "Google", "Microsoft"] },
      { title: "Container With Most Water", lc: "container-with-most-water", level: "Medium", hint: "The shorter wall limits the area — which one is worth moving?", companies: ["Amazon", "Google", "Meta"] },
      { title: "Sort Colors", lc: "sort-colors", level: "Medium", hint: "Three regions, three pointers, one pass.", companies: ["Microsoft", "Amazon"] },
      { title: "Trapping Rain Water", lc: "trapping-rain-water", level: "Hard", hint: "Water at a spot depends on the smaller of the tallest walls on each side.", companies: ["Amazon", "Google", "Goldman Sachs", "Meta"] },
    ],
  },

  // ───────────────────────────── 2. Sliding Window ─────────────────────────────
  {
    slug: "sliding-window",
    name: "Sliding Window",
    category: "Arrays & Strings",
    tagline: "Grow the right edge, shrink the left, never restart.",
    analogy:
      "Imagine reading a long necklace of colored beads through a cardboard tube you can stretch. You stretch the tube forward one bead at a time, and the moment you see a repeated color inside it, you pull the back end forward until the repeat is gone. The tube only ever moves forward, so you never re-read the necklace from scratch.",
    insight:
      "Brute force restarts at every left index and re-scans, re-counting the same characters over and over (`O(n²)` or worse). A window keeps a running summary (a set, a counter, a sum) and updates it **incrementally**: add one element on the right, remove one on the left. Because `left` and `right` only move forward, total work is `O(n)`.",
    cues: [
      "contiguous subarray / substring",
      "longest / shortest / maximum window such that…",
      "at most k distinct characters",
      "without repeating characters",
      "window of size k",
      "contains all characters of t (anagram / permutation)",
    ],
    steps: [
      "Pick the state the window must track (set of chars, `Counter`, running sum).",
      "For each `right`, add `s[right]` to the state.",
      "While the window is invalid, remove `s[left]` from the state and `left += 1`.",
      "Window `[left, right]` is now valid — update the answer (`right - left + 1`).",
      "For fixed-size windows, instead slide both ends together once the size reaches k.",
    ],
    complexity: {
      brute: "O(n²) — try every start, extend every end",
      pattern: "O(n) — each index enters and leaves the window once",
      space: "O(k) — size of the alphabet / window state",
    },
    variations: [
      {
        name: "Variable window: longest valid",
        note: "The visualizer's example — longest substring without repeats. Shrink while invalid, then record.",
        code: `def length_of_longest_substring(s: str) -> int:
    seen = set()
    left = best = 0
    for right, ch in enumerate(s):
        while ch in seen:            # window invalid: shrink
            seen.remove(s[left])
            left += 1
        seen.add(ch)
        best = max(best, right - left + 1)
    return best`,
      },
      {
        name: "Variable window: shortest valid",
        note: "Flip it: expand until valid, then shrink while still valid and record the minimum (Minimum Window Substring, Minimum Size Subarray Sum).",
        code: `def min_subarray_len(target: int, nums: list[int]) -> int:
    left = total = 0
    best = float("inf")
    for right, x in enumerate(nums):
        total += x
        while total >= target:       # valid: try to shrink
            best = min(best, right - left + 1)
            total -= nums[left]
            left += 1
    return 0 if best == float("inf") else best`,
      },
      {
        name: "Fixed-size window",
        note: "Add `nums[i]`, subtract `nums[i-k]`. Great for averages, anagram checks with a 26-length count array.",
      },
      {
        name: "Monotonic deque window",
        note: "When you need the max/min inside each window, keep a deque of candidate indices (Sliding Window Maximum).",
      },
    ],
    mistakes: [
      "Off-by-one on window size: it's `right - left + 1`, not `right - left`.",
      "Using `if` instead of `while` to shrink, leaving the window still invalid.",
      "Updating the answer before the window is valid again.",
      "Forgetting to delete a key from the `Counter` when its count hits 0, so `len(counter)` is wrong for 'k distinct'.",
      "Using sliding window on arrays with negative numbers for sum targets — shrinking no longer guarantees the sum drops (use prefix sums).",
    ],
    problems: [
      { title: "Maximum Average Subarray I", lc: "maximum-average-subarray-i", level: "Easy", hint: "Fixed width: add the new element, drop the old one.", companies: ["Google", "Amazon"] },
      { title: "Longest Substring Without Repeating Characters", lc: "longest-substring-without-repeating-characters", level: "Medium", hint: "When a repeat enters, pull the left edge past it.", companies: ["Amazon", "Google", "Meta", "Microsoft"] },
      { title: "Minimum Size Subarray Sum", lc: "minimum-size-subarray-sum", level: "Medium", hint: "All positives — once the sum is big enough, shrink.", companies: ["Meta", "Amazon"] },
      { title: "Fruit Into Baskets", lc: "fruit-into-baskets", level: "Medium", hint: "Longest window with at most two distinct values.", companies: ["Google", "Amazon"] },
      { title: "Longest Repeating Character Replacement", lc: "longest-repeating-character-replacement", level: "Medium", hint: "Window is valid while length minus its most common char ≤ k.", companies: ["Google", "Amazon", "Uber"] },
      { title: "Permutation in String", lc: "permutation-in-string", level: "Medium", hint: "Fixed window of len(s1); compare letter counts.", companies: ["Microsoft", "Meta"] },
      { title: "Minimum Window Substring", lc: "minimum-window-substring", level: "Hard", hint: "Expand until every needed char is covered, then shrink greedily.", companies: ["Meta", "Amazon", "Google", "LinkedIn"] },
      { title: "Sliding Window Maximum", lc: "sliding-window-maximum", level: "Hard", hint: "Keep only indices that could still become the max.", companies: ["Amazon", "Google", "Microsoft"] },
    ],
  },

  // ───────────────────────────── 3. Prefix Sum ─────────────────────────────
  {
    slug: "prefix-sum",
    name: "Prefix Sum + Hash Map",
    category: "Arrays & Strings",
    tagline: "Any range sum is a difference of two running totals.",
    analogy:
      "Think of a car's odometer. To know how far you drove between two towns, you don't re-drive the road — you subtract the odometer reading at the first town from the reading at the second. If you jot down every reading in a notebook, you can instantly ask, \"was there ever a town exactly k miles behind me?\"",
    insight:
      "A subarray sum `nums[i..j]` equals `prefix[j+1] - prefix[i]`. So \"does some subarray ending here sum to `k`?\" becomes \"have I seen a prefix equal to `current - k`?\" — a single **hash map lookup**. Brute force re-adds every range (`O(n²)`); the map remembers all earlier prefixes so each index is handled in `O(1)`. Unlike sliding window, this works with **negative numbers**.",
    cues: [
      "subarray sum equals k",
      "count the number of subarrays",
      "contains negative numbers",
      "range sum query",
      "sum divisible by k / multiple of k",
      "equal number of 0s and 1s",
    ],
    steps: [
      "Keep a running sum `cur` as you scan left to right.",
      "Seed the map with the empty prefix: `{0: 1}` (for counting) or `{0: -1}` (for lengths).",
      "At each index, look up `cur - k` (or `cur % k`) in the map and add/compare.",
      "Then record `cur` in the map — after the lookup, so a subarray can't be empty.",
    ],
    complexity: {
      brute: "O(n²) — sum every subarray",
      pattern: "O(n) — one pass with O(1) hash lookups",
      space: "O(n) — the prefix map",
    },
    variations: [
      {
        name: "Count subarrays with sum k",
        note: "The visualizer's example. The map stores how many times each prefix sum has appeared.",
        code: `from collections import defaultdict

def subarray_sum(nums: list[int], k: int) -> int:
    seen = defaultdict(int)
    seen[0] = 1                 # empty prefix
    cur = count = 0
    for x in nums:
        cur += x
        count += seen[cur - k]  # subarrays ending here
        seen[cur] += 1
    return count`,
      },
      {
        name: "Longest subarray (store first index)",
        note: "Store the earliest index of each prefix; length is `i - first[cur - k]`. Contiguous Array maps 0 to -1 so the target becomes sum 0.",
        code: `def find_max_length(nums: list[int]) -> int:
    first = {0: -1}
    cur = best = 0
    for i, x in enumerate(nums):
        cur += 1 if x else -1
        if cur in first:
            best = max(best, i - first[cur])
        else:
            first[cur] = i      # keep the earliest only
    return best`,
      },
      {
        name: "Modulo prefix",
        note: "Two prefixes with the same remainder mod k bound a subarray divisible by k. Normalize negatives with Python's `%` (already non-negative).",
      },
      {
        name: "2-D prefix sums",
        note: "`P[r][c]` = sum of the rectangle from (0,0). Any sub-rectangle is 4 lookups with inclusion–exclusion.",
      },
    ],
    mistakes: [
      "Forgetting to seed `{0: 1}`, which misses subarrays that start at index 0.",
      "Inserting `cur` into the map before the lookup, counting an empty subarray when k = 0.",
      "For 'longest', overwriting the first index of a prefix with a later one.",
      "Reaching for a sliding window when the array has negatives.",
      "Off-by-one in range queries: `prefix` has length n+1, and sum(i..j) is `prefix[j+1] - prefix[i]`.",
    ],
    problems: [
      { title: "Find Pivot Index", lc: "find-pivot-index", level: "Easy", hint: "Left sum vs total minus left minus current.", companies: ["Amazon", "Meta"] },
      { title: "Range Sum Query - Immutable", lc: "range-sum-query-immutable", level: "Easy", hint: "Precompute once, answer each query by subtraction.", companies: ["Meta", "Amazon"] },
      { title: "Subarray Sum Equals K", lc: "subarray-sum-equals-k", level: "Medium", hint: "Which earlier running total would make this one work?", companies: ["Meta", "Amazon", "Google", "Microsoft"] },
      { title: "Contiguous Array", lc: "contiguous-array", level: "Medium", hint: "Treat 0 as -1; you're now looking for sum 0.", companies: ["Meta", "Amazon"] },
      { title: "Continuous Subarray Sum", lc: "continuous-subarray-sum", level: "Medium", hint: "Same remainder twice, at least two apart.", companies: ["Meta", "Amazon"] },
      { title: "Subarray Sums Divisible by K", lc: "subarray-sums-divisible-by-k", level: "Medium", hint: "Count prefix remainders, not prefix sums.", companies: ["Meta", "Amazon"] },
      { title: "Count Number of Nice Subarrays", lc: "count-number-of-nice-subarrays", level: "Medium", hint: "Map each number to 1 if odd, 0 if even — familiar now?", companies: ["Google", "Amazon"] },
      { title: "Number of Submatrices That Sum to Target", lc: "number-of-submatrices-that-sum-to-target", level: "Hard", hint: "Fix a pair of rows, collapse columns, reuse the 1-D trick.", companies: ["Google", "Meta"] },
    ],
  },

  // ───────────────────────────── 4. Binary Search ─────────────────────────────
  {
    slug: "binary-search",
    name: "Binary Search",
    category: "Arrays & Strings",
    tagline: "Halve the search space every step — on arrays or answers.",
    analogy:
      "Guessing a number between 1 and 1,000 where your friend only says \"higher\" or \"lower\": you always guess the middle, so ten guesses are enough. The trick works on anything where a yes/no answer flips exactly once, like finding the slowest walking pace that still gets you home before dark.",
    insight:
      "Brute force checks every candidate one by one. If a yes/no question is **monotonic** — all `False` then all `True` — one probe at the middle rules out half the candidates, giving `O(log n)` probes. The candidates don't have to be array indices: they can be speeds, capacities or days (**binary search on the answer**).",
    cues: [
      "sorted array / rotated sorted array",
      "find the first / last position of",
      "minimum capacity / speed / time such that…",
      "O(log n) required",
      "maximize the minimum (or minimize the maximum)",
      "find a peak / boundary",
    ],
    steps: [
      "Define a predicate `ok(x)` that is False…False, True…True over the search range.",
      "Set `lo` and `hi` to bound the answer (inclusive or half-open — pick one and stick to it).",
      "Loop: `mid = (lo + hi) // 2`; if `ok(mid)` shrink to the left half (keep mid), else move right past mid.",
      "When the loop ends, `lo` is the first True — check it's in range before returning.",
    ],
    complexity: {
      brute: "O(n) — scan every candidate (or O(n · range) for answer-search)",
      pattern: "O(log n) probes — O(n log range) when each probe costs O(n)",
      space: "O(1)",
    },
    variations: [
      {
        name: "Classic exact match",
        note: "The visualizer's example: find target in a sorted array, closed interval `[lo, hi]`.",
        code: `def search(nums: list[int], target: int) -> int:
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1`,
      },
      {
        name: "First True / lower bound template",
        note: "The one template to memorize. Half-open `[lo, hi)`; returns the first index where `ok` is True (or `hi` if none). Same as `bisect_left` when `ok = nums[i] >= target`.",
        code: `def first_true(lo: int, hi: int, ok) -> int:
    # smallest x in [lo, hi) with ok(x) True; hi if none
    while lo < hi:
        mid = (lo + hi) // 2
        if ok(mid):
            hi = mid          # mid might be the answer
        else:
            lo = mid + 1      # mid is definitely not
    return lo

def lower_bound(nums: list[int], target: int) -> int:
    return first_true(0, len(nums), lambda i: nums[i] >= target)`,
      },
      {
        name: "Binary search on the answer (Koko)",
        note: "Search the speed, not the array. `ok(speed)` = can she finish within h hours? Faster always works if slower works, so it's monotonic.",
        code: `def min_eating_speed(piles: list[int], h: int) -> int:
    def ok(speed: int) -> bool:
        hours = sum((p + speed - 1) // speed for p in piles)
        return hours <= h

    lo, hi = 1, max(piles)
    while lo < hi:
        mid = (lo + hi) // 2
        if ok(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo`,
      },
      {
        name: "Rotated sorted array",
        note: "At least one half around `mid` is sorted; check whether the target lies in that sorted half to decide which way to go.",
      },
    ],
    mistakes: [
      "Mixing templates: `while lo < hi` with `hi = mid - 1` skips the answer; `while lo <= hi` with `hi = mid` loops forever.",
      "Setting the answer range wrong for search-on-answer (e.g. `lo = 0` causes division by zero in Koko).",
      "Using a non-monotonic predicate — binary search silently returns garbage.",
      "Computing hours with float division instead of ceiling integer division `(p + s - 1) // s`.",
      "Not checking the returned index is in bounds and actually equals target for lower-bound searches.",
    ],
    problems: [
      { title: "Binary Search", lc: "binary-search", level: "Easy", hint: "Compare to the middle, discard half.", companies: ["Google", "Microsoft"] },
      { title: "Search Insert Position", lc: "search-insert-position", level: "Easy", hint: "First index whose value is ≥ target.", companies: ["Amazon", "Apple"] },
      { title: "First Bad Version", lc: "first-bad-version", level: "Easy", hint: "Good…good, bad…bad — find the first bad.", companies: ["Meta", "Microsoft"] },
      { title: "Find First and Last Position of Element in Sorted Array", lc: "find-first-and-last-position-of-element-in-sorted-array", level: "Medium", hint: "Two lower-bound searches: for target and target + 1.", companies: ["Meta", "Amazon", "LinkedIn"] },
      { title: "Search in Rotated Sorted Array", lc: "search-in-rotated-sorted-array", level: "Medium", hint: "One side of mid is always sorted.", companies: ["Meta", "Amazon", "Microsoft", "LinkedIn"] },
      { title: "Koko Eating Bananas", lc: "koko-eating-bananas", level: "Medium", hint: "Search over speeds; can she finish in time?", companies: ["Google", "Amazon", "Airbnb"] },
      { title: "Capacity To Ship Packages Within D Days", lc: "capacity-to-ship-packages-within-d-days", level: "Medium", hint: "Guess a capacity, simulate the days.", companies: ["Amazon", "Google"] },
      { title: "Median of Two Sorted Arrays", lc: "median-of-two-sorted-arrays", level: "Hard", hint: "Binary search the cut position in the smaller array.", companies: ["Google", "Amazon", "Goldman Sachs", "Apple"] },
    ],
  },

  // ───────────────────────────── 5. Monotonic Stack ─────────────────────────────
  {
    slug: "monotonic-stack",
    name: "Monotonic Stack",
    category: "Arrays & Strings",
    tagline: "Unanswered items wait on a stack until someone bigger arrives.",
    analogy:
      "People line up for a view, shortest at the back. Each newcomer taller than the person in front lets that shorter person finally see their answer — \"the first taller person behind me\" — and that person leaves the line. Anyone still waiting is shorter than everyone ahead of them, so the line is always neatly ordered.",
    insight:
      "Brute force scans right from every element looking for the next warmer day: `O(n²)`. The stack holds only the days **still waiting** for an answer, kept in decreasing order. A new day pops every colder day it answers; each index is pushed once and popped once, so the whole thing is `O(n)`.",
    cues: [
      "next greater / next smaller element",
      "how many days until a warmer temperature",
      "previous less element",
      "span (consecutive days ≤ today)",
      "largest rectangle in histogram",
      "remove digits to make the smallest number",
    ],
    steps: [
      "Decide what you need: next greater → keep a decreasing stack; next smaller → increasing stack.",
      "Push **indices**, not values, so you can compute distances.",
      "For each `i`, while the stack top is beaten by `nums[i]`, pop it and record `i` as its answer.",
      "Push `i`. Anything left on the stack at the end has no answer (default 0 / -1).",
    ],
    complexity: {
      brute: "O(n²) — scan ahead from every element",
      pattern: "O(n) — each index pushed and popped at most once",
      space: "O(n) — the stack",
    },
    variations: [
      {
        name: "Next greater (Daily Temperatures)",
        note: "The visualizer's example: a decreasing stack of indices still waiting for a warmer day.",
        code: `def daily_temperatures(temps: list[int]) -> list[int]:
    ans = [0] * len(temps)
    stack = []                      # indices, temps decreasing
    for i, t in enumerate(temps):
        while stack and temps[stack[-1]] < t:
            j = stack.pop()
            ans[j] = i - j          # i is j's warmer day
        stack.append(i)
    return ans`,
      },
      {
        name: "Circular array",
        note: "Loop `i` over `range(2 * n)` and use `i % n` — the second lap answers elements that wrap around.",
      },
      {
        name: "Previous + next smaller (histogram)",
        note: "When a bar is popped, the new top is its left boundary and the current index its right boundary — compute area right then.",
        code: `def largest_rectangle_area(heights: list[int]) -> int:
    stack, best = [], 0             # increasing heights
    for i, h in enumerate(heights + [0]):
        while stack and heights[stack[-1]] >= h:
            top = heights[stack.pop()]
            left = stack[-1] if stack else -1
            best = max(best, top * (i - left - 1))
        stack.append(i)
    return best`,
      },
      {
        name: "Greedy digit removal",
        note: "Remove K Digits: pop larger digits from an increasing stack while you still have removals left.",
      },
    ],
    mistakes: [
      "Pushing values instead of indices, then being unable to compute distances.",
      "Using `<=` vs `<` wrongly — matters for duplicates (strictly greater vs greater-or-equal).",
      "Forgetting the sentinel / final flush, so elements left on the stack are never processed (histogram).",
      "Choosing the wrong monotonic direction (increasing vs decreasing) for the question.",
    ],
    problems: [
      { title: "Next Greater Element I", lc: "next-greater-element-i", level: "Easy", hint: "Precompute next-greater for nums2 once.", companies: ["Amazon", "Bloomberg"] },
      { title: "Daily Temperatures", lc: "daily-temperatures", level: "Medium", hint: "Who's still waiting for a warmer day?", companies: ["Amazon", "Meta", "Google"] },
      { title: "Online Stock Span", lc: "online-stock-span", level: "Medium", hint: "Collapse smaller previous prices into the current one.", companies: ["Amazon", "Microsoft"] },
      { title: "Next Greater Element II", lc: "next-greater-element-ii", level: "Medium", hint: "Walk the array twice.", companies: ["Amazon", "Google"] },
      { title: "Remove K Digits", lc: "remove-k-digits", level: "Medium", hint: "A bigger digit before a smaller one should go.", companies: ["Amazon", "Microsoft"] },
      { title: "Sum of Subarray Minimums", lc: "sum-of-subarray-minimums", level: "Medium", hint: "For each element: how far left and right is it the minimum?", companies: ["Amazon", "Google"] },
      { title: "Largest Rectangle in Histogram", lc: "largest-rectangle-in-histogram", level: "Hard", hint: "A bar's rectangle ends at the first shorter bar on each side.", companies: ["Amazon", "Google", "Microsoft"] },
      { title: "Maximal Rectangle", lc: "maximal-rectangle", level: "Hard", hint: "Each row is the base of a histogram.", companies: ["Google", "Meta"] },
    ],
  },

  // ───────────────────────────── 6. Merge Intervals ─────────────────────────────
  {
    slug: "intervals",
    name: "Merge Intervals",
    category: "Arrays & Strings",
    tagline: "Sort by start, then only compare with the last one.",
    analogy:
      "You're combining everyone's meeting times onto one calendar. If you lay the meetings out in order of start time, you only ever need to ask, \"does this meeting start before the last block I wrote down ends?\" If yes, stretch that block; if no, start a new one.",
    insight:
      "Unsorted, any interval might overlap any other, so you'd compare all pairs (`O(n²)`). After sorting by start, an interval can only overlap the **most recent merged block** — everything earlier already ended. That turns merging into a single linear pass after an `O(n log n)` sort.",
    cues: [
      "list of intervals [start, end]",
      "merge overlapping",
      "insert a new interval",
      "minimum number of rooms / arrows / removals",
      "free time / gaps between meetings",
      "intersection of two interval lists",
    ],
    steps: [
      "Sort intervals by start (or by end for greedy 'max non-overlapping' questions).",
      "Start the output with the first interval.",
      "For each next interval: if `start <= last_end`, extend `last_end = max(last_end, end)`.",
      "Otherwise append it as a new block.",
    ],
    complexity: {
      brute: "O(n²) — compare every pair, repeatedly",
      pattern: "O(n log n) — sort, then one linear pass",
      space: "O(n) — output (O(log n)–O(n) for the sort)",
    },
    variations: [
      {
        name: "Merge overlapping",
        note: "The visualizer's example.",
        code: `def merge(intervals: list[list[int]]) -> list[list[int]]:
    intervals.sort(key=lambda iv: iv[0])
    out = [intervals[0][:]]
    for start, end in intervals[1:]:
        if start <= out[-1][1]:             # overlaps last block
            out[-1][1] = max(out[-1][1], end)
        else:
            out.append([start, end])
    return out`,
      },
      {
        name: "Max non-overlapping (sort by end)",
        note: "Greedy: always keep the interval that finishes earliest. Answers Non-overlapping Intervals and Minimum Arrows.",
        code: `def erase_overlap_intervals(intervals: list[list[int]]) -> int:
    intervals.sort(key=lambda iv: iv[1])
    kept, last_end = 0, float("-inf")
    for start, end in intervals:
        if start >= last_end:
            kept += 1
            last_end = end
    return len(intervals) - kept`,
      },
      {
        name: "Sweep line / min rooms",
        note: "Turn each interval into +1 at start and -1 at end, sort events, track the running max. A min-heap of end times works too.",
      },
      {
        name: "Two-list intersection",
        note: "Two pointers over two sorted lists; overlap is `[max(starts), min(ends)]`; advance the one that ends first.",
      },
    ],
    mistakes: [
      "Forgetting to sort first.",
      "Setting `last_end = end` instead of `max(last_end, end)` — a short interval inside a long one shrinks the block.",
      "Getting touching intervals wrong: is `[1,2]` and `[2,3]` an overlap? Read the problem (`<=` vs `<`).",
      "Mutating the input lists you appended to the output, aliasing bugs when the caller reuses them.",
    ],
    problems: [
      { title: "Summary Ranges", lc: "summary-ranges", level: "Easy", hint: "Build ranges while the next number continues the run.", companies: ["Google", "Meta"] },
      { title: "Merge Intervals", lc: "merge-intervals", level: "Medium", hint: "After sorting, who can the next interval possibly overlap?", companies: ["Meta", "Google", "Amazon", "Microsoft"] },
      { title: "Insert Interval", lc: "insert-interval", level: "Medium", hint: "Three phases: before, overlapping, after.", companies: ["Google", "LinkedIn", "Meta"] },
      { title: "Non-overlapping Intervals", lc: "non-overlapping-intervals", level: "Medium", hint: "Keep the one that ends first.", companies: ["Meta", "Amazon"] },
      { title: "Minimum Number of Arrows to Burst Balloons", lc: "minimum-number-of-arrows-to-burst-balloons", level: "Medium", hint: "Shoot at the earliest end point.", companies: ["Amazon", "Microsoft"] },
      { title: "Interval List Intersections", lc: "interval-list-intersections", level: "Medium", hint: "Two pointers; advance whoever finishes first.", companies: ["Meta", "Uber"] },
      { title: "Car Pooling", lc: "car-pooling", level: "Medium", hint: "Passengers on at start, off at end — track the peak.", companies: ["Google", "Lyft"] },
      { title: "Data Stream as Disjoint Intervals", lc: "data-stream-as-disjoint-intervals", level: "Hard", hint: "Keep intervals sorted; a new number can join neighbours.", companies: ["Google", "Amazon"] },
    ],
  },

  // ───────────────────────────── 7. Greedy ─────────────────────────────
  {
    slug: "greedy",
    name: "Greedy",
    category: "Arrays & Strings",
    tagline: "Make the locally best choice and never look back.",
    analogy:
      "Crossing a river on stepping stones, you keep track of the farthest stone you could possibly reach so far. Every stone you stand on might push that \"farthest\" mark further out. If you ever stand on a stone beyond the mark, you know you couldn't have gotten there.",
    insight:
      "Brute force explores every sequence of choices (exponential, or `O(n²)` DP for Jump Game). Greedy works when you can prove one simple summary — like **farthest reachable index** — captures everything that matters about the past. Then one pass updating that summary replaces the whole search tree.",
    cues: [
      "can you reach the end",
      "minimum number of jumps / steps",
      "maximize profit with unlimited transactions",
      "assign / schedule to satisfy as many as possible",
      "partition into as many parts as possible",
      "circular route with gas / cost",
    ],
    steps: [
      "Identify the single quantity to track (farthest reach, running surplus, last occurrence).",
      "Scan once, updating that quantity at each element.",
      "Detect failure early (current index beyond reach, surplus negative).",
      "Sanity-check the greedy choice with a small counterexample hunt — if one exists, you need DP.",
    ],
    complexity: {
      brute: "O(2ⁿ) recursion / O(n²) DP — try every path",
      pattern: "O(n) — one pass (O(n log n) if sorting first)",
      space: "O(1)",
    },
    variations: [
      {
        name: "Farthest reach (Jump Game)",
        note: "The visualizer's example.",
        code: `def can_jump(nums: list[int]) -> bool:
    reach = 0
    for i, step in enumerate(nums):
        if i > reach:              # stranded before i
            return False
        reach = max(reach, i + step)
    return True`,
      },
      {
        name: "Min jumps as BFS levels (Jump Game II)",
        note: "Treat each jump as a level: `end` is the edge of the current level, `reach` the edge of the next.",
        code: `def jump(nums: list[int]) -> int:
    jumps = end = reach = 0
    for i in range(len(nums) - 1):
        reach = max(reach, i + nums[i])
        if i == end:               # must jump now
            jumps += 1
            end = reach
    return jumps`,
      },
      {
        name: "Sort then greedy",
        note: "Assign Cookies, intervals by end time: sorting exposes the obvious best choice.",
      },
      {
        name: "Running surplus (Gas Station)",
        note: "If the tank goes negative at i, no start between the old start and i works — restart at i + 1.",
      },
    ],
    mistakes: [
      "Applying greedy without proof — Coin Change with arbitrary coins breaks greedy.",
      "In Jump Game II, looping to the last index and counting an extra jump.",
      "Checking `i > reach` after updating reach instead of before.",
      "Sorting by the wrong key (start instead of end) in scheduling problems.",
    ],
    problems: [
      { title: "Assign Cookies", lc: "assign-cookies", level: "Easy", hint: "Smallest cookie that satisfies the least greedy child.", companies: ["Amazon"] },
      { title: "Best Time to Buy and Sell Stock II", lc: "best-time-to-buy-and-sell-stock-ii", level: "Medium", hint: "Collect every upward step.", companies: ["Amazon", "Bloomberg", "Meta"] },
      { title: "Jump Game", lc: "jump-game", level: "Medium", hint: "Track how far you could get.", companies: ["Amazon", "Meta", "Microsoft"] },
      { title: "Jump Game II", lc: "jump-game-ii", level: "Medium", hint: "Think of reachable ranges as BFS levels.", companies: ["Amazon", "Google"] },
      { title: "Gas Station", lc: "gas-station", level: "Medium", hint: "If you run dry at i, every start before i fails too.", companies: ["Amazon", "Google", "Bloomberg"] },
      { title: "Partition Labels", lc: "partition-labels", level: "Medium", hint: "A part can't end before the last occurrence of any letter in it.", companies: ["Amazon", "Meta"] },
      { title: "Hand of Straights", lc: "hand-of-straights", level: "Medium", hint: "The smallest card must start a group.", companies: ["Google"] },
      { title: "Candy", lc: "candy", level: "Hard", hint: "Two passes: left neighbours, then right neighbours.", companies: ["Amazon", "Microsoft"] },
    ],
  },

  // ───────────────────────────── 8. Fast & Slow Pointers ─────────────────────────────
  {
    slug: "fast-slow-pointers",
    name: "Fast & Slow Pointers",
    category: "Linked Lists",
    tagline: "A runner twice as fast laps you only if there's a loop.",
    analogy:
      "Two runners on a track, one twice as fast. On a straight road the fast one simply finishes first; on a circular track the fast one eventually comes up behind the slow one and taps them on the shoulder. Whether they ever meet tells you whether the track loops.",
    insight:
      "Brute force remembers every visited node in a set (`O(n)` memory). With two pointers at speeds 1 and 2, once both are in the cycle the gap shrinks by one each step, so they **must** meet within one lap — `O(1)` memory. The same speed trick finds the middle (fast hits the end when slow is halfway) and, with a reset, the cycle entrance.",
    cues: [
      "linked list has a cycle",
      "find where the cycle begins",
      "middle of the linked list",
      "O(1) extra space",
      "repeated process ends in a loop (happy number)",
      "array values in range 1..n used as next pointers",
    ],
    steps: [
      "Start `slow = fast = head`.",
      "Loop while `fast and fast.next`: move slow one step, fast two steps.",
      "If they meet, there's a cycle; if fast falls off the end, there isn't.",
      "For the cycle start: reset one pointer to head and move both one step until they meet.",
    ],
    complexity: {
      brute: "O(n) time, O(n) space — hash set of visited nodes",
      pattern: "O(n) — fast laps slow within one cycle length",
      space: "O(1)",
    },
    variations: [
      {
        name: "Cycle detection (Floyd)",
        note: "The visualizer's example.",
        code: `def has_cycle(head) -> bool:
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            return True
    return False`,
      },
      {
        name: "Cycle entrance",
        note: "Distance from head to entrance equals distance from meeting point to entrance (mod cycle length).",
        code: `def detect_cycle(head):
    slow = fast = head
    while fast and fast.next:
        slow, fast = slow.next, fast.next.next
        if slow is fast:
            slow = head
            while slow is not fast:
                slow, fast = slow.next, fast.next
            return slow
    return None`,
      },
      {
        name: "Find the middle",
        note: "When fast reaches the end, slow is at the middle — the setup for Palindrome List and Reorder List.",
      },
      {
        name: "Implicit linked list",
        note: "Find the Duplicate Number: treat `i -> nums[i]` as a next pointer; the duplicate is the cycle entrance.",
      },
    ],
    mistakes: [
      "Checking `fast.next.next` without first checking `fast.next` → AttributeError on None.",
      "Comparing values (`==`) instead of node identity (`is`).",
      "Checking `slow is fast` before moving them, so they 'meet' at head immediately.",
      "Off-by-one for even-length lists: decide whether you want the first or second middle.",
    ],
    problems: [
      { title: "Linked List Cycle", lc: "linked-list-cycle", level: "Easy", hint: "Will a faster runner ever catch a slower one?", companies: ["Amazon", "Microsoft", "Bloomberg"] },
      { title: "Middle of the Linked List", lc: "middle-of-the-linked-list", level: "Easy", hint: "Half speed lands halfway.", companies: ["Amazon", "Apple"] },
      { title: "Happy Number", lc: "happy-number", level: "Easy", hint: "The digit-square process is a hidden linked list.", companies: ["Google", "Apple"] },
      { title: "Palindrome Linked List", lc: "palindrome-linked-list", level: "Easy", hint: "Find the middle, then compare halves.", companies: ["Meta", "Amazon", "Microsoft"] },
      { title: "Linked List Cycle II", lc: "linked-list-cycle-ii", level: "Medium", hint: "After meeting, restart one pointer from head.", companies: ["Amazon", "Microsoft"] },
      { title: "Remove Nth Node From End of List", lc: "remove-nth-node-from-end-of-list", level: "Medium", hint: "Give one pointer an n-step head start.", companies: ["Meta", "Amazon", "Google"] },
      { title: "Reorder List", lc: "reorder-list", level: "Medium", hint: "Middle, reverse second half, weave.", companies: ["Meta", "Amazon"] },
      { title: "Find the Duplicate Number", lc: "find-the-duplicate-number", level: "Medium", hint: "Indices as nodes, values as next pointers.", companies: ["Google", "Amazon", "Microsoft"] },
    ],
  },

  // ───────────────────────────── 9. Linked List Reversal ─────────────────────────────
  {
    slug: "linked-list-reversal",
    name: "In-place Reversal",
    category: "Linked Lists",
    tagline: "Flip one arrow at a time with prev, curr, next.",
    analogy:
      "A conga line where each person holds the shoulder of the person ahead. To turn the line around, you walk along it and ask each person to let go and hold the person who was behind them instead — but before they let go, you note who was ahead so you don't lose the rest of the line.",
    insight:
      "Copying into an array and rebuilding costs `O(n)` extra memory. Reversal rewires each `next` pointer **in place**, using just three references: the node you came from (`prev`), the node you're on (`curr`), and a saved handle to the rest (`nxt`). Each node is touched once — `O(n)` time, `O(1)` space.",
    cues: [
      "reverse the linked list",
      "reverse between positions left and right",
      "reverse in groups of k",
      "in-place, O(1) memory",
      "swap nodes in pairs",
      "compare first half with reversed second half",
    ],
    steps: [
      "Set `prev = None`, `curr = head` (use a dummy node if the head can change).",
      "Save `nxt = curr.next` before touching anything.",
      "Point `curr.next = prev`.",
      "Advance: `prev = curr`, `curr = nxt`. Repeat until `curr` is None; `prev` is the new head.",
    ],
    complexity: {
      brute: "O(n) time, O(n) space — copy to an array and rebuild",
      pattern: "O(n) — each node rewired once",
      space: "O(1)",
    },
    variations: [
      {
        name: "Full reversal",
        note: "The visualizer's example.",
        code: `def reverse_list(head):
    prev, curr = None, head
    while curr:
        nxt = curr.next     # save the rest
        curr.next = prev    # flip the arrow
        prev, curr = curr, nxt
    return prev`,
      },
      {
        name: "Reverse a sublist (left..right)",
        note: "Walk a dummy to the node before `left`, then repeatedly move the next node to the front of the sublist.",
        code: `def reverse_between(head, left: int, right: int):
    dummy = ListNode(0, head)
    before = dummy
    for _ in range(left - 1):
        before = before.next
    curr = before.next
    for _ in range(right - left):
        moved = curr.next
        curr.next = moved.next
        moved.next = before.next
        before.next = moved
    return dummy.next`,
      },
      {
        name: "Reverse in k-groups",
        note: "Check k nodes exist, reverse them, reconnect the previous group's tail to the new head, repeat.",
      },
      {
        name: "Recursive reversal",
        note: "`new_head = reverse(head.next); head.next.next = head; head.next = None`. Elegant, but O(n) stack.",
      },
    ],
    mistakes: [
      "Overwriting `curr.next` before saving it — the rest of the list is lost.",
      "Returning `curr` (None) instead of `prev` at the end.",
      "Forgetting a dummy node when the head itself gets reversed, then losing the new head.",
      "Not reconnecting the reversed segment's tail to the remainder (sublist / k-group).",
    ],
    problems: [
      { title: "Reverse Linked List", lc: "reverse-linked-list", level: "Easy", hint: "Three references are all you need.", companies: ["Amazon", "Microsoft", "Apple", "Meta"] },
      { title: "Palindrome Linked List", lc: "palindrome-linked-list", level: "Easy", hint: "Reverse only the second half.", companies: ["Meta", "Amazon"] },
      { title: "Reverse Linked List II", lc: "reverse-linked-list-ii", level: "Medium", hint: "Anchor the node just before the segment.", companies: ["Meta", "Amazon", "Microsoft"] },
      { title: "Swap Nodes in Pairs", lc: "swap-nodes-in-pairs", level: "Medium", hint: "It's reversal with k = 2.", companies: ["Amazon", "Microsoft"] },
      { title: "Rotate List", lc: "rotate-list", level: "Medium", hint: "Close it into a ring, then cut at the right spot.", companies: ["Amazon", "LinkedIn"] },
      { title: "Maximum Twin Sum of a Linked List", lc: "maximum-twin-sum-of-a-linked-list", level: "Medium", hint: "Reverse the second half and walk both halves together.", companies: ["Amazon"] },
      { title: "Reverse Nodes in k-Group", lc: "reverse-nodes-in-k-group", level: "Hard", hint: "Count k ahead before you flip anything.", companies: ["Amazon", "Microsoft", "Meta", "Google"] },
    ],
  },

  // ───────────────────────────── 10. Heap / Top-K ─────────────────────────────
  {
    slug: "top-k-heap",
    name: "Heap / Top-K",
    category: "Heaps",
    tagline: "Keep a tiny heap of the best k; evict the weakest.",
    analogy:
      "A talent show only has k chairs on stage. Each new contestant is compared with the weakest person currently seated; if the newcomer is better, the weakest leaves and the newcomer sits. At the end, the weakest person on stage is exactly the k-th best performer overall.",
    insight:
      "Sorting everything costs `O(n log n)` even though you only care about `k` items. A **size-k min-heap** keeps just the current top k, with the weakest at the root for `O(1)` peeking and `O(log k)` replacement. That's `O(n log k)` time and `O(k)` memory — and it works on streams you can't sort.",
    cues: [
      "kth largest / kth smallest",
      "top k frequent",
      "k closest points",
      "merge k sorted lists",
      "running median / data stream",
      "always process the smallest / earliest next",
    ],
    steps: [
      "Pick the heap type: for k **largest** use a **min**-heap of size k (Python's `heapq` is a min-heap).",
      "Push each item; if the heap grows beyond k, `heappop` the smallest.",
      "The root `heap[0]` is the k-th largest; the heap contents are the top k.",
      "For max-heap behaviour, push negated keys or `(-priority, item)` tuples.",
    ],
    complexity: {
      brute: "O(n log n) — sort everything",
      pattern: "O(n log k) — each push/pop is log k",
      space: "O(k)",
    },
    variations: [
      {
        name: "Kth largest (size-k min-heap)",
        note: "The visualizer's example.",
        code: `import heapq

def find_kth_largest(nums: list[int], k: int) -> int:
    heap = []
    for x in nums:
        heapq.heappush(heap, x)
        if len(heap) > k:
            heapq.heappop(heap)   # evict the weakest
    return heap[0]`,
      },
      {
        name: "Top K frequent",
        note: "Count with `Counter`, then keep a size-k heap of `(freq, value)`. `heapq.nlargest(k, cnt, key=cnt.get)` does the same.",
        code: `import heapq
from collections import Counter

def top_k_frequent(nums: list[int], k: int) -> list[int]:
    cnt = Counter(nums)
    heap = []
    for val, freq in cnt.items():
        heapq.heappush(heap, (freq, val))
        if len(heap) > k:
            heapq.heappop(heap)
    return [val for _, val in heap]`,
      },
      {
        name: "K-way merge",
        note: "Seed the heap with the head of each list as `(value, list_index, node)`; pop the smallest and push its successor.",
      },
      {
        name: "Two heaps (median)",
        note: "Max-heap for the lower half, min-heap for the upper half; rebalance so sizes differ by at most one.",
      },
    ],
    mistakes: [
      "Using a max-heap of all n elements for 'k largest' — that's O(n + k log n) memory you didn't need.",
      "Forgetting `heapq` is a min-heap and not negating for max-heap behaviour.",
      "Pushing objects that can't be compared on ties (ListNode) — add a tiebreaker index to the tuple.",
      "Returning `heap[-1]` thinking it's the max — a heap list is not sorted.",
    ],
    problems: [
      { title: "Kth Largest Element in a Stream", lc: "kth-largest-element-in-a-stream", level: "Easy", hint: "Keep only k seats on stage.", companies: ["Amazon", "Meta"] },
      { title: "Last Stone Weight", lc: "last-stone-weight", level: "Easy", hint: "Always grab the two heaviest.", companies: ["Amazon", "Google"] },
      { title: "Kth Largest Element in an Array", lc: "kth-largest-element-in-an-array", level: "Medium", hint: "You don't need the whole array sorted.", companies: ["Meta", "Amazon", "Microsoft", "LinkedIn"] },
      { title: "Top K Frequent Elements", lc: "top-k-frequent-elements", level: "Medium", hint: "Count first, then keep the best k counts.", companies: ["Amazon", "Meta", "Google"] },
      { title: "K Closest Points to Origin", lc: "k-closest-points-to-origin", level: "Medium", hint: "Keep the k smallest distances — which heap evicts the farthest?", companies: ["Meta", "Amazon", "LinkedIn"] },
      { title: "Task Scheduler", lc: "task-scheduler", level: "Medium", hint: "Always run the most frequent available task.", companies: ["Meta", "Amazon", "Microsoft"] },
      { title: "Merge k Sorted Lists", lc: "merge-k-sorted-lists", level: "Hard", hint: "The next output node is the smallest of k heads.", companies: ["Amazon", "Meta", "Google", "Microsoft"] },
      { title: "Find Median from Data Stream", lc: "find-median-from-data-stream", level: "Hard", hint: "Two heaps facing each other.", companies: ["Amazon", "Google", "Microsoft"] },
    ],
  },

  // ───────────────────────────── 11. Tree BFS ─────────────────────────────
  {
    slug: "tree-bfs",
    name: "Tree BFS (Level Order)",
    category: "Trees",
    tagline: "Process the tree floor by floor using a queue.",
    analogy:
      "Picture a family tree photo shoot: first the grandparents stand in a row, then all their children, then all the grandchildren. A helper with a clipboard calls each person forward, and as they step up they point to their own kids, who join the back of the waiting line.",
    insight:
      "A queue naturally outputs nodes in order of their distance from the root. By snapshotting `len(queue)` at the start of each round, you know exactly which nodes belong to the current **level**, so per-level questions (right side view, averages, zigzag) need no extra depth bookkeeping. Every node is enqueued and dequeued once: `O(n)`.",
    cues: [
      "level order / level by level",
      "right side view / left view",
      "minimum depth / shortest path in a tree",
      "average / max of each level",
      "zigzag order",
      "connect nodes on the same level",
    ],
    steps: [
      "Put the root in a `deque` (return early if root is None).",
      "While the queue isn't empty, record `size = len(queue)` — that's one level.",
      "Pop `size` nodes, handle each, and append their non-null children.",
      "After the inner loop, finalize that level's result.",
    ],
    complexity: {
      brute: "O(n·h) — re-walk from the root for each depth",
      pattern: "O(n) — each node enqueued once",
      space: "O(w) — widest level (up to n/2)",
    },
    variations: [
      {
        name: "Level-order traversal",
        note: "The visualizer's example.",
        code: `from collections import deque

def level_order(root) -> list[list[int]]:
    if not root:
        return []
    res, q = [], deque([root])
    while q:
        level = []
        for _ in range(len(q)):          # exactly this level
            node = q.popleft()
            level.append(node.val)
            if node.left:
                q.append(node.left)
            if node.right:
                q.append(node.right)
        res.append(level)
    return res`,
      },
      {
        name: "Right side view",
        note: "Keep only the last node popped in each level.",
      },
      {
        name: "Zigzag",
        note: "Build each level normally, then reverse every other level (or append to a deque from alternating ends).",
      },
      {
        name: "Min depth / early exit",
        note: "The first leaf you dequeue is at the minimum depth — BFS can stop immediately, unlike DFS.",
      },
    ],
    mistakes: [
      "Using `list.pop(0)` instead of `deque.popleft()` — O(n) per pop.",
      "Reading `len(q)` inside the loop condition, so it changes as children are added.",
      "Appending `None` children and then crashing on `.val`.",
      "Forgetting the empty-tree case.",
    ],
    problems: [
      { title: "Minimum Depth of Binary Tree", lc: "minimum-depth-of-binary-tree", level: "Easy", hint: "The first leaf you meet floor by floor wins.", companies: ["Amazon", "Meta"] },
      { title: "Average of Levels in Binary Tree", lc: "average-of-levels-in-binary-tree", level: "Easy", hint: "Sum and count per level.", companies: ["Meta", "Amazon"] },
      { title: "Binary Tree Level Order Traversal", lc: "binary-tree-level-order-traversal", level: "Medium", hint: "Freeze the queue length at the start of each floor.", companies: ["Amazon", "Meta", "Microsoft", "LinkedIn"] },
      { title: "Binary Tree Right Side View", lc: "binary-tree-right-side-view", level: "Medium", hint: "Who's last on each floor?", companies: ["Meta", "Amazon", "Bloomberg"] },
      { title: "Binary Tree Zigzag Level Order Traversal", lc: "binary-tree-zigzag-level-order-traversal", level: "Medium", hint: "Same BFS, flip direction each level.", companies: ["Amazon", "Microsoft", "Bloomberg"] },
      { title: "Populating Next Right Pointers in Each Node", lc: "populating-next-right-pointers-in-each-node", level: "Medium", hint: "Neighbours on the same floor are adjacent in the queue.", companies: ["Microsoft", "Amazon"] },
      { title: "Maximum Width of Binary Tree", lc: "maximum-width-of-binary-tree", level: "Medium", hint: "Number positions like a heap: 2i and 2i+1.", companies: ["Amazon", "Google"] },
      { title: "Serialize and Deserialize Binary Tree", lc: "serialize-and-deserialize-binary-tree", level: "Hard", hint: "Level order with explicit null markers.", companies: ["Amazon", "Meta", "Google", "LinkedIn"] },
    ],
  },

  // ───────────────────────────── 12. Tree DFS ─────────────────────────────
  {
    slug: "tree-dfs",
    name: "Tree DFS (Recursion)",
    category: "Trees",
    tagline: "Trust children to answer; combine their answers on the way up.",
    analogy:
      "A manager wants to know the longest chain of command below them. Instead of walking every path, they ask each direct report, \"how deep is your team?\", and each report asks their reports the same thing. Answers bubble back up, and the manager just takes the bigger number and adds one for themselves.",
    insight:
      "Most tree questions are 'combine answers from the left subtree and the right subtree'. With **post-order** recursion, each call returns a small summary (depth, height, sum, is-valid) and the parent computes its own in `O(1)`. Each node is visited once — `O(n)` — instead of recomputing subtree facts repeatedly from every ancestor.",
    cues: [
      "maximum depth / height",
      "diameter / longest path",
      "path sum from root to leaf",
      "validate a BST",
      "lowest common ancestor",
      "is the tree balanced / symmetric",
    ],
    steps: [
      "Write the base case: what does `None` return? (0, True, empty, -inf…)",
      "Recurse on `node.left` and `node.right` and trust the results.",
      "Combine them into this node's answer and return it.",
      "If the global answer differs from what you return (diameter, max path), update a nonlocal best on the side.",
    ],
    complexity: {
      brute: "O(n²) — recompute heights from every node (e.g. naive balanced check)",
      pattern: "O(n) — each node visited once",
      space: "O(h) — recursion stack (O(n) worst case for a skewed tree)",
    },
    variations: [
      {
        name: "Post-order return value (max depth)",
        note: "The visualizer's example.",
        code: `def max_depth(root) -> int:
    if not root:
        return 0
    left = max_depth(root.left)
    right = max_depth(root.right)
    return 1 + max(left, right)`,
      },
      {
        name: "Return one thing, track another (diameter)",
        note: "Return height to the parent, but update the best diameter `left + right` at every node.",
        code: `def diameter_of_binary_tree(root) -> int:
    best = 0
    def height(node) -> int:
        nonlocal best
        if not node:
            return 0
        l, r = height(node.left), height(node.right)
        best = max(best, l + r)       # path through node
        return 1 + max(l, r)
    height(root)
    return best`,
      },
      {
        name: "Pre-order with passed-down state",
        note: "Pass bounds or running sums *down* (validate BST with `(lo, hi)`, path sum with remaining target).",
      },
      {
        name: "Backtracking on paths",
        note: "Append node to `path`, recurse, then `path.pop()` — Path Sum II, Binary Tree Paths.",
      },
    ],
    mistakes: [
      "Validating a BST by only comparing a node with its direct children instead of passing down bounds.",
      "Treating a node with one child as a leaf in min-depth / path-sum problems.",
      "Returning the global answer (diameter) instead of the local one (height) to the parent.",
      "Hitting Python's recursion limit on very deep skewed trees — consider an iterative stack.",
    ],
    problems: [
      { title: "Maximum Depth of Binary Tree", lc: "maximum-depth-of-binary-tree", level: "Easy", hint: "Ask both children, take the bigger, add one.", companies: ["Amazon", "LinkedIn", "Microsoft"] },
      { title: "Invert Binary Tree", lc: "invert-binary-tree", level: "Easy", hint: "Swap, then let recursion handle the rest.", companies: ["Google", "Amazon"] },
      { title: "Diameter of Binary Tree", lc: "diameter-of-binary-tree", level: "Easy", hint: "Return height, but record left + right.", companies: ["Meta", "Amazon", "Google"] },
      { title: "Balanced Binary Tree", lc: "balanced-binary-tree", level: "Easy", hint: "Compute height and balance in the same pass.", companies: ["Amazon", "Bloomberg"] },
      { title: "Validate Binary Search Tree", lc: "validate-binary-search-tree", level: "Medium", hint: "Every node lives inside a range set by its ancestors.", companies: ["Amazon", "Meta", "Microsoft", "Bloomberg"] },
      { title: "Lowest Common Ancestor of a Binary Tree", lc: "lowest-common-ancestor-of-a-binary-tree", level: "Medium", hint: "If both sides report a hit, you're the answer.", companies: ["Meta", "Amazon", "Microsoft", "LinkedIn"] },
      { title: "Path Sum II", lc: "path-sum-ii", level: "Medium", hint: "Carry the remaining target down; undo on the way back.", companies: ["Amazon", "Meta"] },
      { title: "Binary Tree Maximum Path Sum", lc: "binary-tree-maximum-path-sum", level: "Hard", hint: "Return the best single arm; record the best bend.", companies: ["Meta", "Amazon", "Google", "Microsoft"] },
    ],
  },

  // ───────────────────────────── 13. Graph Traversal ─────────────────────────────
  {
    slug: "graph-traversal",
    name: "Graph BFS / DFS (Grids)",
    category: "Graphs",
    tagline: "Flood-fill each unseen region once; count the floods.",
    analogy:
      "Looking at a map of islands, you drop a bucket of paint on any unpainted patch of land. The paint spreads to every connected bit of land and stops at water. Count how many times you had to pick up a new bucket — that's the number of islands.",
    insight:
      "A grid is a graph where each cell links to its up/down/left/right neighbours. Brute force might re-explore the same land from many starting cells. Marking cells **visited** the moment you reach them guarantees each cell is processed once, so the whole scan is `O(rows × cols)`. BFS additionally gives **shortest distance** in unweighted grids.",
    cues: [
      "2-D grid of '1's and '0's",
      "number of islands / connected regions",
      "shortest path in a maze / unweighted graph",
      "spread over time (rotting, fire, infection)",
      "flood fill / paint bucket",
      "cells reachable from the border",
    ],
    steps: [
      "Scan every cell; when you find an unvisited target cell, start a traversal and bump the count.",
      "From that cell, BFS (queue) or DFS (stack/recursion) into the 4 neighbours that are in bounds and valid.",
      "Mark a cell visited when you **push** it, not when you pop it, to avoid duplicates.",
      "For shortest-time / distance problems, use multi-source BFS: seed the queue with all sources at once.",
    ],
    complexity: {
      brute: "O((R·C)²) — re-explore regions from every cell",
      pattern: "O(R·C) — each cell visited once",
      space: "O(R·C) — visited set / queue (or in-place marking)",
    },
    variations: [
      {
        name: "Number of islands (flood fill)",
        note: "The visualizer's example. Sinks visited land in place by flipping '1' to '0'.",
        code: `def num_islands(grid: list[list[str]]) -> int:
    R, C = len(grid), len(grid[0])
    def sink(r: int, c: int) -> None:
        stack = [(r, c)]
        grid[r][c] = "0"
        while stack:
            r, c = stack.pop()
            for nr, nc in ((r+1, c), (r-1, c), (r, c+1), (r, c-1)):
                if 0 <= nr < R and 0 <= nc < C and grid[nr][nc] == "1":
                    grid[nr][nc] = "0"     # mark on push
                    stack.append((nr, nc))
    count = 0
    for r in range(R):
        for c in range(C):
            if grid[r][c] == "1":
                count += 1
                sink(r, c)
    return count`,
      },
      {
        name: "Multi-source BFS (Rotting Oranges)",
        note: "Enqueue every rotten orange at time 0; each BFS level is one minute.",
        code: `from collections import deque

def oranges_rotting(grid: list[list[int]]) -> int:
    R, C = len(grid), len(grid[0])
    q = deque((r, c) for r in range(R) for c in range(C) if grid[r][c] == 2)
    fresh = sum(row.count(1) for row in grid)
    minutes = 0
    while q and fresh:
        minutes += 1
        for _ in range(len(q)):
            r, c = q.popleft()
            for nr, nc in ((r+1, c), (r-1, c), (r, c+1), (r, c-1)):
                if 0 <= nr < R and 0 <= nc < C and grid[nr][nc] == 1:
                    grid[nr][nc] = 2
                    fresh -= 1
                    q.append((nr, nc))
    return -1 if fresh else minutes`,
      },
      {
        name: "Reverse flood from the border",
        note: "Surrounded Regions, Pacific Atlantic: start from the edges and mark what's reachable, instead of testing every cell.",
      },
      {
        name: "Adjacency-list graphs",
        note: "Same idea with `graph[u]` neighbours and a `visited` set (Clone Graph, Word Ladder).",
      },
    ],
    mistakes: [
      "Marking visited on pop instead of push, so the same cell gets queued many times.",
      "Bounds checks in the wrong order (`grid[nr][nc]` before `0 <= nr < R`) — negative indices silently wrap in Python.",
      "Recursive DFS on a 300×300 grid blowing the recursion limit — use an explicit stack.",
      "Counting BFS minutes off by one (incrementing after the last level, or when no fresh oranges exist).",
    ],
    problems: [
      { title: "Flood Fill", lc: "flood-fill", level: "Easy", hint: "Spread from one cell to same-coloured neighbours.", companies: ["Amazon", "Microsoft"] },
      { title: "Number of Islands", lc: "number-of-islands", level: "Medium", hint: "Each new paint bucket is one island.", companies: ["Amazon", "Meta", "Google", "Microsoft"] },
      { title: "Max Area of Island", lc: "max-area-of-island", level: "Medium", hint: "Count cells while you flood.", companies: ["Amazon", "Google"] },
      { title: "Rotting Oranges", lc: "rotting-oranges", level: "Medium", hint: "All rotten oranges spread at the same time.", companies: ["Amazon", "Microsoft", "Google"] },
      { title: "Surrounded Regions", lc: "surrounded-regions", level: "Medium", hint: "What's safe is connected to the border.", companies: ["Google", "Amazon"] },
      { title: "Pacific Atlantic Water Flow", lc: "pacific-atlantic-water-flow", level: "Medium", hint: "Let water flow uphill from each ocean.", companies: ["Google", "Amazon"] },
      { title: "Clone Graph", lc: "clone-graph", level: "Medium", hint: "Map old node → new node as you traverse.", companies: ["Meta", "Google", "Amazon"] },
      { title: "Word Ladder", lc: "word-ladder", level: "Hard", hint: "Words are nodes; one-letter changes are edges; shortest path.", companies: ["Amazon", "Meta", "Google", "LinkedIn"] },
    ],
  },

  // ───────────────────────────── 14. Topological Sort ─────────────────────────────
  {
    slug: "topological-sort",
    name: "Topological Sort",
    category: "Graphs",
    tagline: "Do whatever has no blockers left, then unblock the rest.",
    analogy:
      "Getting dressed: socks before shoes, shirt before tie. You look at the pile and put on anything nothing else must come before. Each time you put something on, other items become free to wear. If you end up stuck with clothes left and every one still waiting on another, your rules contain a loop.",
    insight:
      "Trying all orderings is factorial. Kahn's algorithm tracks each node's **in-degree** (number of unmet prerequisites). Nodes at 0 are ready; finishing one decrements its dependents. Each edge is processed once, so it's `O(V + E)` — and if fewer than V nodes ever reach 0, there's a **cycle**.",
    cues: [
      "prerequisites / dependencies",
      "can you finish all courses",
      "valid build / task order",
      "detect a cycle in a directed graph",
      "a must come before b",
      "recipes / ingredients that unlock others",
    ],
    steps: [
      "Build the adjacency list `prereq -> [dependents]` and an `indegree` array.",
      "Queue every node with `indegree == 0`.",
      "Pop a node, append it to the order, decrement each dependent's in-degree; queue any that hit 0.",
      "If the order contains all V nodes it's valid; otherwise a cycle exists.",
    ],
    complexity: {
      brute: "O(V!) — try every ordering",
      pattern: "O(V + E) — each node and edge handled once",
      space: "O(V + E) — graph + in-degree array",
    },
    variations: [
      {
        name: "Kahn's algorithm (Course Schedule II)",
        note: "The visualizer's example.",
        code: `from collections import deque

def find_order(n: int, prerequisites: list[list[int]]) -> list[int]:
    graph = [[] for _ in range(n)]
    indeg = [0] * n
    for course, pre in prerequisites:
        graph[pre].append(course)
        indeg[course] += 1
    q = deque(i for i in range(n) if indeg[i] == 0)
    order = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in graph[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    return order if len(order) == n else []`,
      },
      {
        name: "DFS with three colours",
        note: "0 = unvisited, 1 = on the current path, 2 = done. Seeing a 1 again means a cycle; reverse post-order is a topo order.",
        code: `def can_finish(n: int, prerequisites: list[list[int]]) -> bool:
    graph = [[] for _ in range(n)]
    for course, pre in prerequisites:
        graph[pre].append(course)
    state = [0] * n
    def dfs(u: int) -> bool:          # True if no cycle
        if state[u]:
            return state[u] == 2
        state[u] = 1
        if not all(dfs(v) for v in graph[u]):
            return False
        state[u] = 2
        return True
    return all(dfs(i) for i in range(n))`,
      },
      {
        name: "Longest path in a DAG",
        note: "Process in topo order and relax `dist[v] = max(dist[v], dist[u] + w)` — Parallel Courses III.",
      },
    ],
    mistakes: [
      "Reversing the edge direction (`course -> pre` instead of `pre -> course`).",
      "Forgetting isolated nodes with no edges — they still need to be in the order.",
      "Using a plain visited set for cycle detection in DFS; a directed graph needs the 'on current path' state.",
      "Returning a partial order instead of `[]` when a cycle exists.",
    ],
    problems: [
      { title: "Course Schedule", lc: "course-schedule", level: "Medium", hint: "Can every course's blockers eventually clear?", companies: ["Amazon", "Meta", "Google", "Microsoft"] },
      { title: "Course Schedule II", lc: "course-schedule-ii", level: "Medium", hint: "Record the order in which blockers clear.", companies: ["Amazon", "Meta", "Google"] },
      { title: "Find All Possible Recipes from Given Supplies", lc: "find-all-possible-recipes-from-given-supplies", level: "Medium", hint: "Ingredients are prerequisites of recipes.", companies: ["Google", "Amazon"] },
      { title: "Find Eventual Safe States", lc: "find-eventual-safe-states", level: "Medium", hint: "Reverse the edges and peel off nodes with no outgoing paths.", companies: ["Google", "Amazon"] },
      { title: "Course Schedule IV", lc: "course-schedule-iv", level: "Medium", hint: "Propagate prerequisite sets in topological order.", companies: ["Google", "Amazon"] },
      { title: "Minimum Height Trees", lc: "minimum-height-trees", level: "Medium", hint: "Peel leaves layer by layer toward the centre.", companies: ["Google", "Amazon"] },
      { title: "Parallel Courses III", lc: "parallel-courses-iii", level: "Hard", hint: "Earliest finish = own time + latest-finishing prerequisite.", companies: ["Google", "Amazon"] },
      { title: "Sort Items by Groups Respecting Dependencies", lc: "sort-items-by-groups-respecting-dependencies", level: "Hard", hint: "Two levels of topological sort: groups, then items.", companies: ["Google"] },
    ],
  },

  // ───────────────────────────── 15. Union-Find ─────────────────────────────
  {
    slug: "union-find",
    name: "Union-Find (DSU)",
    category: "Graphs",
    tagline: "Every group elects a leader; merging means one leader bows.",
    analogy:
      "At a party, everyone points to a friend who points to someone else, until you reach the group's host. To check if two guests are in the same group, follow the pointing to each host. When two groups meet, one host just starts pointing at the other host — and guests who walked the chain start pointing closer to the host so next time it's quicker.",
    insight:
      "Re-running BFS after every new edge to check connectivity costs `O(V + E)` each time. Union-Find answers \"same group?\" and \"merge groups\" in nearly `O(1)` amortized, thanks to **path compression** (or path halving) and **union by size/rank**. Counting components is just: start at n, subtract 1 each time a union actually merges two different roots.",
    cues: [
      "number of connected components / provinces",
      "edges arrive one by one (dynamic connectivity)",
      "redundant connection / creates a cycle",
      "group accounts / emails that share something",
      "are x and y connected",
      "minimum cost to connect all (Kruskal)",
    ],
    steps: [
      "Initialize `parent[i] = i` and `size[i] = 1`; `components = n`.",
      "`find(x)`: walk up to the root, halving the path as you go.",
      "`union(a, b)`: find both roots; if equal, they're already connected (cycle!).",
      "Otherwise attach the smaller tree under the larger, and `components -= 1`.",
    ],
    complexity: {
      brute: "O(E·(V + E)) — re-run BFS/DFS after each edge",
      pattern: "O(E · α(V)) ≈ O(E) — near-constant per operation",
      space: "O(V)",
    },
    variations: [
      {
        name: "DSU with path halving + union by size",
        note: "The visualizer's example — counting components.",
        code: `class DSU:
    def __init__(self, n: int):
        self.parent = list(range(n))
        self.size = [1] * n
        self.components = n

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]  # halve
            x = self.parent[x]
        return x

    def union(self, a: int, b: int) -> bool:
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False                # already connected
        if self.size[ra] < self.size[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra
        self.size[ra] += self.size[rb]
        self.components -= 1
        return True`,
      },
      {
        name: "Cycle detection (Redundant Connection)",
        note: "The first edge whose `union` returns False closes a cycle.",
      },
      {
        name: "Keyed DSU",
        note: "When nodes are strings (emails), use a dict `parent.setdefault(x, x)` instead of an array.",
      },
      {
        name: "Kruskal's MST",
        note: "Sort edges by weight; add each edge whose endpoints are in different sets.",
      },
    ],
    mistakes: [
      "Setting `parent[a] = b` instead of `parent[find(a)] = find(b)` — merges nodes, not groups.",
      "Decrementing the component count even when both nodes already share a root.",
      "Skipping path compression and union by size, degrading to O(n) per find on chains.",
      "Comparing `parent[a] == parent[b]` instead of `find(a) == find(b)`.",
    ],
    problems: [
      { title: "Find if Path Exists in Graph", lc: "find-if-path-exists-in-graph", level: "Easy", hint: "Same leader means same group.", companies: ["Amazon", "Google"] },
      { title: "Number of Provinces", lc: "number-of-provinces", level: "Medium", hint: "Start with n groups; each real merge removes one.", companies: ["Amazon", "Meta", "Google"] },
      { title: "Redundant Connection", lc: "redundant-connection", level: "Medium", hint: "Which edge joins two already-joined nodes?", companies: ["Google", "Amazon"] },
      { title: "Number of Operations to Make Network Connected", lc: "number-of-operations-to-make-network-connected", level: "Medium", hint: "Spare cables vs components minus one.", companies: ["Amazon", "Microsoft"] },
      { title: "Satisfiability of Equality Equations", lc: "satisfiability-of-equality-equations", level: "Medium", hint: "Union all '==' first, then check every '!='.", companies: ["Google"] },
      { title: "Accounts Merge", lc: "accounts-merge", level: "Medium", hint: "Emails are nodes; an account unions its emails.", companies: ["Meta", "Google", "Amazon"] },
      { title: "Most Stones Removed with Same Row or Column", lc: "most-stones-removed-with-same-row-or-column", level: "Medium", hint: "Answer = stones minus number of groups.", companies: ["Google", "Amazon"] },
      { title: "Swim in Rising Water", lc: "swim-in-rising-water", level: "Hard", hint: "Add cells by height until corners connect.", companies: ["Google", "Amazon"] },
    ],
  },

  // ───────────────────────────── 16. Backtracking ─────────────────────────────
  {
    slug: "backtracking",
    name: "Backtracking",
    category: "Recursion & DP",
    tagline: "Choose, explore, un-choose — walk every branch of the decision tree.",
    analogy:
      "Packing a picnic basket by trying combinations: you put an apple in, see what else you could add, then take the apple back out and try without it. Because you always undo your last move before trying the next option, the basket is always in the right state for whatever you try next.",
    insight:
      "Some problems genuinely need every answer (all subsets, all permutations), so exponential output is unavoidable. Backtracking makes it cheap per answer by **reusing one mutable path**: append, recurse, pop. Pruning (stop when the sum exceeds target, skip duplicate values) cuts whole subtrees before you waste time inside them.",
    cues: [
      "return all possible subsets / combinations / permutations",
      "generate all valid …",
      "each number may be used once / unlimited times",
      "place n queens / solve sudoku",
      "partition a string into …",
      "word search in a grid",
    ],
    steps: [
      "Define the state: a `path` list plus a `start` index (combinations) or `used` set (permutations).",
      "Base case: if the path is a complete answer, record a **copy** (`path[:]`).",
      "Loop over the next choices: choose (append), explore (recurse), un-choose (pop).",
      "Add pruning: break when a sorted candidate already overshoots; skip equal neighbours to avoid duplicates.",
    ],
    complexity: {
      brute: "Same exponential search, but rebuilding lists each call costs extra",
      pattern: "O(2ⁿ · n) subsets, O(n! · n) permutations — proportional to output",
      space: "O(n) — recursion depth + current path",
    },
    variations: [
      {
        name: "Subsets (take / skip tree)",
        note: "The visualizer's example: every node of the decision tree is an answer.",
        code: `def subsets(nums: list[int]) -> list[list[int]]:
    res, path = [], []
    def backtrack(start: int) -> None:
        res.append(path[:])            # every node is a subset
        for i in range(start, len(nums)):
            path.append(nums[i])       # choose
            backtrack(i + 1)           # explore
            path.pop()                 # un-choose
    backtrack(0)
    return res`,
      },
      {
        name: "Permutations (used set)",
        note: "Order matters, so every position can take any unused element; no `start` index.",
        code: `def permute(nums: list[int]) -> list[list[int]]:
    res, path, used = [], [], [False] * len(nums)
    def backtrack() -> None:
        if len(path) == len(nums):
            res.append(path[:])
            return
        for i, x in enumerate(nums):
            if used[i]:
                continue
            used[i] = True
            path.append(x)
            backtrack()
            path.pop()
            used[i] = False
    backtrack()
    return res`,
      },
      {
        name: "Combination Sum (reuse allowed + pruning)",
        note: "Recurse with `i` (not `i + 1`) so a number can repeat; sort and `break` once a candidate exceeds the remainder.",
        code: `def combination_sum(candidates: list[int], target: int) -> list[list[int]]:
    candidates.sort()
    res, path = [], []
    def backtrack(start: int, remain: int) -> None:
        if remain == 0:
            res.append(path[:])
            return
        for i in range(start, len(candidates)):
            c = candidates[i]
            if c > remain:
                break                  # sorted: rest are too big
            path.append(c)
            backtrack(i, remain - c)   # i, not i+1: reuse allowed
            path.pop()
    backtrack(0, target)
    return res`,
      },
      {
        name: "Duplicates in input",
        note: "Sort, then `if i > start and nums[i] == nums[i-1]: continue` (Subsets II, Combination Sum II).",
      },
    ],
    mistakes: [
      "Appending `path` instead of `path[:]` — every saved answer ends up as the same (empty) list.",
      "Forgetting to pop (un-choose), so the path keeps growing across branches.",
      "Using `i + 1` vs `i` vs `start` wrongly — mixes up reuse, combinations and permutations.",
      "Dedup check `i > 0` instead of `i > start`, which wrongly skips valid answers.",
      "In grid word search, not restoring the cell after marking it visited.",
    ],
    problems: [
      { title: "Binary Tree Paths", lc: "binary-tree-paths", level: "Easy", hint: "Extend the path going down, trim it coming back.", companies: ["Google", "Meta"] },
      { title: "Subsets", lc: "subsets", level: "Medium", hint: "Each element: in or out.", companies: ["Meta", "Amazon", "Google"] },
      { title: "Permutations", lc: "permutations", level: "Medium", hint: "Any unused element can go in the next slot.", companies: ["Microsoft", "Amazon", "LinkedIn"] },
      { title: "Combination Sum", lc: "combination-sum", level: "Medium", hint: "You may pick the same number again — where does the next call start?", companies: ["Airbnb", "Amazon", "Uber"] },
      { title: "Subsets II", lc: "subsets-ii", level: "Medium", hint: "Sort, then skip equal siblings.", companies: ["Amazon", "Meta"] },
      { title: "Letter Combinations of a Phone Number", lc: "letter-combinations-of-a-phone-number", level: "Medium", hint: "One digit per level of the tree.", companies: ["Amazon", "Meta", "Uber"] },
      { title: "Word Search", lc: "word-search", level: "Medium", hint: "Mark a cell while it's on the path, unmark on the way back.", companies: ["Amazon", "Microsoft", "Meta"] },
      { title: "N-Queens", lc: "n-queens", level: "Hard", hint: "One queen per row; track used columns and diagonals.", companies: ["Amazon", "Google", "Microsoft"] },
    ],
  },

  // ───────────────────────────── 17. 1-D DP ─────────────────────────────
  {
    slug: "dp-1d",
    name: "1-D Dynamic Programming",
    category: "Recursion & DP",
    tagline: "Best answer here = best of a few earlier answers.",
    analogy:
      "A burglar walks down a street of houses, but robbing two neighbours sets off the alarm. At each house they only need to ask: \"is it better to rob this house plus my best haul from two doors back, or skip it and keep my best haul from the last house?\" A sticky note with those two numbers is all they carry.",
    insight:
      "Plain recursion re-solves the same suffix/prefix exponentially many times (`rob(i)` gets called from `i+1` and `i+2`, and so on). DP stores each subproblem's answer once: `dp[i] = max(dp[i-1], dp[i-2] + nums[i])`. That's `n` subproblems × `O(1)` work = `O(n)`, and since you only look back two steps, the table shrinks to **two variables**.",
    cues: [
      "maximum / minimum total with a restriction",
      "number of ways to reach / decode",
      "cannot pick adjacent elements",
      "climbing stairs, 1 or 2 steps",
      "fewest coins to make amount",
      "can the string be segmented",
    ],
    steps: [
      "Define `dp[i]` in one sentence (e.g. 'max money from the first i houses').",
      "Write the recurrence from the last decision: take vs skip, or which coin/step was used last.",
      "Set base cases (`dp[0]`, `dp[1]`) carefully.",
      "Fill in order so dependencies are ready; return the right cell.",
      "If `dp[i]` only needs a few previous cells, roll them into variables.",
    ],
    complexity: {
      brute: "O(2ⁿ) — plain recursion recomputes overlapping subproblems",
      pattern: "O(n) — each state computed once (O(n·k) with k choices per state)",
      space: "O(1) with rolling variables, O(n) with a table",
    },
    variations: [
      {
        name: "Take vs skip (House Robber)",
        note: "The visualizer's example.",
        code: `def rob(nums: list[int]) -> int:
    prev2 = prev1 = 0          # best up to i-2, i-1
    for x in nums:
        take = prev2 + x
        skip = prev1
        prev2, prev1 = prev1, max(take, skip)
    return prev1`,
      },
      {
        name: "Unbounded choices (Coin Change)",
        note: "`dp[a] = 1 + min(dp[a - c])` over coins; initialize to infinity, `dp[0] = 0`.",
        code: `def coin_change(coins: list[int], amount: int) -> int:
    INF = amount + 1
    dp = [0] + [INF] * amount
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a:
                dp[a] = min(dp[a], dp[a - c] + 1)
    return dp[amount] if dp[amount] != INF else -1`,
      },
      {
        name: "Top-down memo",
        note: "Write the recursion, add `@functools.cache`. Fastest way to a correct answer in an interview; convert to bottom-up if asked.",
      },
      {
        name: "Look-back over all j < i (LIS, Word Break)",
        note: "`dp[i]` depends on every earlier `dp[j]`, giving O(n²); LIS has an O(n log n) patience-sorting upgrade.",
      },
    ],
    mistakes: [
      "Not defining what `dp[i]` means before coding, then mixing 'up to i' and 'ending at i'.",
      "Wrong base cases (e.g. Decode Ways with a leading '0').",
      "Updating rolling variables in the wrong order and overwriting a value you still need.",
      "Initializing a min-DP with 0 instead of infinity.",
      "House Robber II: forgetting the first and last houses are adjacent — run twice excluding each end.",
    ],
    problems: [
      { title: "Climbing Stairs", lc: "climbing-stairs", level: "Easy", hint: "How could you have arrived at the last step?", companies: ["Amazon", "Google", "Adobe"] },
      { title: "Min Cost Climbing Stairs", lc: "min-cost-climbing-stairs", level: "Easy", hint: "Cheapest way to stand on step i.", companies: ["Amazon"] },
      { title: "House Robber", lc: "house-robber", level: "Medium", hint: "Rob this one plus two back, or skip it.", companies: ["Amazon", "Google", "Cisco"] },
      { title: "House Robber II", lc: "house-robber-ii", level: "Medium", hint: "Break the circle two different ways.", companies: ["Amazon", "Microsoft"] },
      { title: "Decode Ways", lc: "decode-ways", level: "Medium", hint: "Last char alone, or last two together?", companies: ["Meta", "Google", "Amazon"] },
      { title: "Coin Change", lc: "coin-change", level: "Medium", hint: "Which coin did you use last?", companies: ["Amazon", "Google", "Microsoft"] },
      { title: "Word Break", lc: "word-break", level: "Medium", hint: "A prefix is breakable if it ends with a word after a breakable prefix.", companies: ["Amazon", "Meta", "Google"] },
      { title: "Longest Increasing Subsequence", lc: "longest-increasing-subsequence", level: "Medium", hint: "Best chain ending at i, built from any smaller earlier end.", companies: ["Microsoft", "Google", "Amazon"] },
    ],
  },

  // ───────────────────────────── 18. 2-D DP ─────────────────────────────
  {
    slug: "dp-2d",
    name: "2-D Dynamic Programming",
    category: "Recursion & DP",
    tagline: "A grid of subproblems, each filled from its neighbours.",
    analogy:
      "Two friends compare their travel diaries to find the longest list of cities they both visited in the same order. They fill a chart: each square answers \"using my first i entries and your first j entries, how long is our shared list?\" Each square is filled by glancing at the squares just above, left or diagonally up-left.",
    insight:
      "Comparing two sequences by brute force means trying all `2ⁿ` subsequences of one against the other. But every question shrinks to a **prefix pair** `(i, j)`, and there are only `m × n` such pairs. Each cell is `O(1)` from its neighbours: on a match, `dp[i-1][j-1] + 1`; otherwise the better of dropping a char from either side.",
    cues: [
      "two strings / two sequences",
      "longest common subsequence",
      "minimum edits to convert",
      "number of unique paths in a grid",
      "palindromic subsequence (i..j ranges)",
      "match with wildcards / regex",
    ],
    steps: [
      "Define `dp[i][j]` over prefixes (`s[:i]`, `t[:j]`) or a range (`s[i..j]`).",
      "Add an extra row/column for empty prefixes so base cases are simple.",
      "Write the transition: what happens when `s[i-1] == t[j-1]`, and when it doesn't.",
      "Fill rows top-to-bottom, columns left-to-right (or by increasing length for ranges).",
      "Optionally compress to one or two rows since each row only needs the previous one.",
    ],
    complexity: {
      brute: "O(2ⁿ · m) — enumerate subsequences or paths",
      pattern: "O(m · n) — each cell filled once in O(1)",
      space: "O(m · n), or O(min(m, n)) with row compression",
    },
    variations: [
      {
        name: "Longest Common Subsequence",
        note: "The visualizer's example: match → diagonal + 1, else max of up and left.",
        code: `def longest_common_subsequence(a: str, b: str) -> int:
    m, n = len(a), len(b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[m][n]`,
      },
      {
        name: "Edit Distance",
        note: "Mismatch costs `1 + min(insert, delete, replace)` = left, up, diagonal. Base row/column are 0..n and 0..m.",
        code: `def min_distance(a: str, b: str) -> int:
    m, n = len(a), len(b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    return dp[m][n]`,
      },
      {
        name: "Grid paths",
        note: "Unique Paths / Minimum Path Sum: `dp[r][c]` from top and left neighbours; compresses to one row.",
      },
      {
        name: "Interval DP",
        note: "`dp[i][j]` over a substring range, filled by increasing length (Longest Palindromic Subsequence).",
      },
    ],
    mistakes: [
      "Index confusion between `dp[i][j]` and `s[i-1]` when using the extra empty-prefix row.",
      "Building the table with `[[0] * n] * m` — every row is the same list object.",
      "Forgetting to initialise the first row/column (edit distance needs 0..n, not zeros).",
      "Filling interval DP row-by-row instead of by increasing length, reading cells not yet computed.",
      "Row compression that overwrites `dp[j-1]` from the previous row before using it as the diagonal.",
    ],
    problems: [
      { title: "Pascal's Triangle", lc: "pascals-triangle", level: "Easy", hint: "Each cell is the sum of the two above it.", companies: ["Amazon", "Apple"] },
      { title: "Unique Paths", lc: "unique-paths", level: "Medium", hint: "You arrived from the top or from the left.", companies: ["Google", "Amazon", "Meta"] },
      { title: "Minimum Path Sum", lc: "minimum-path-sum", level: "Medium", hint: "Cheapest arrival from top or left.", companies: ["Amazon", "Google"] },
      { title: "Longest Common Subsequence", lc: "longest-common-subsequence", level: "Medium", hint: "Match? Go diagonal. No match? Drop a char from one side.", companies: ["Amazon", "Google", "Microsoft"] },
      { title: "Longest Palindromic Subsequence", lc: "longest-palindromic-subsequence", level: "Medium", hint: "Compare the two ends of each range.", companies: ["Amazon", "LinkedIn"] },
      { title: "Edit Distance", lc: "edit-distance", level: "Medium", hint: "Insert, delete, replace — three neighbours.", companies: ["Google", "Amazon", "Microsoft"] },
      { title: "Distinct Subsequences", lc: "distinct-subsequences", level: "Hard", hint: "On a match, you may use this char or skip it.", companies: ["Google", "Amazon"] },
      { title: "Regular Expression Matching", lc: "regular-expression-matching", level: "Hard", hint: "A star means zero copies or one more copy.", companies: ["Google", "Meta", "Amazon", "Microsoft"] },
    ],
  },
];
