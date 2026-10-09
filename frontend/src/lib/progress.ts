"use client";

import { useSyncExternalStore } from "react";

// Per-browser progress (solved problems, finished lessons). localStorage only — no account needed.
const KEY = "patternwise:progress:v1";
const EMPTY: ReadonlySet<string> = new Set();
let cache: Set<string> | null = null;
const listeners = new Set<() => void>();

function read(): Set<string> {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

function write(next: Set<string>) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    /* storage blocked — progress just won't persist */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useProgress(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function toggleProgress(id: string, on?: boolean) {
  const next = new Set(read());
  const want = on ?? !next.has(id);
  if (want) next.add(id);
  else next.delete(id);
  write(next);
}
