import { useSyncExternalStore } from "react";
import { EMPTY_CONTEXT, type InterviewSession } from "./types";

export type Stage = "setup" | "interview" | "report";
export interface AppState {
  stage: Stage;
  session: InterviewSession | null;
}

const STORAGE_KEY = "ai-interview-coach:v2";
export const INITIAL: AppState = { stage: "setup", session: null };

let state: AppState | null = null; // lazily restored from sessionStorage on first client read
const listeners = new Set<() => void>();

function restore(): AppState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.stage !== "setup" && !parsed.session) return INITIAL;
    if (parsed.session && !parsed.session.context) {
      parsed.session = { ...parsed.session, context: EMPTY_CONTEXT };
    }
    return parsed;
  } catch {
    return INITIAL;
  }
}

function getSnapshot(): AppState {
  if (state === null) state = restore();
  return state;
}

function getServerSnapshot(): AppState {
  return INITIAL;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setAppState(next: AppState | ((prev: AppState) => AppState)) {
  state = typeof next === "function" ? next(getSnapshot()) : next;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — the app still works, just without refresh persistence */
  }
  listeners.forEach((l) => l());
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const noop = () => () => {};
/** false during SSR/hydration, true once the client has taken over. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
