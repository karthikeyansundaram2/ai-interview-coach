"use client";

import { useCallback } from "react";
import { InterviewScreen } from "@/components/InterviewScreen";
import { ReportScreen } from "@/components/ReportScreen";
import { SetupScreen } from "@/components/SetupScreen";
import { INITIAL, setAppState, useAppState, useHydrated } from "@/lib/store";
import type { InterviewSession } from "@/lib/types";

export function InterviewApp() {
  const state = useAppState();
  const hydrated = useHydrated();

  const startInterview = useCallback((session: InterviewSession) => {
    setAppState({ stage: "interview", session });
  }, []);
  const updateSession = useCallback((session: InterviewSession) => {
    setAppState((s) => ({ ...s, session }));
  }, []);
  const finishInterview = useCallback(() => {
    setAppState((s) => (s.session ? { stage: "report", session: s.session } : INITIAL));
  }, []);
  const restart = useCallback(() => setAppState(INITIAL), []);

  // Avoid a flash of the setup screen while an in-progress interview is being restored.
  if (!hydrated) return <div className="min-h-dvh bg-bg" />;

  if (state.stage === "interview" && state.session) {
    return (
      <InterviewScreen
        session={state.session}
        onUpdate={updateSession}
        onFinished={finishInterview}
        onAbort={restart}
      />
    );
  }
  if (state.stage === "report" && state.session) {
    return <ReportScreen session={state.session} onRestart={restart} />;
  }
  return <SetupScreen onStart={startInterview} />;
}
