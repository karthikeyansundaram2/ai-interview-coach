export type Difficulty = "Easy" | "Medium" | "Hard";
export const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

export type Round =
  | "Phone screen"
  | "Technical"
  | "System design"
  | "Behavioral"
  | "Hiring manager"
  | "Final round";
export const ROUNDS: Round[] = [
  "Phone screen",
  "Technical",
  "System design",
  "Behavioral",
  "Hiring manager",
  "Final round",
];

export type Role = "interviewer" | "candidate";

export interface Message {
  role: Role;
  content: string;
}

export interface ResumeProfile {
  summary: string;
  experience_level: string;
  key_skills: string[];
  notable_projects: string[];
}

export interface Resume {
  filename: string;
  text: string;
  word_count: number;
  profile: ResumeProfile | null;
}

/** Optional personalisation sent to the backend on every call. */
export interface InterviewContext {
  round: Round | null;
  target_role: string | null;
  resume_text: string | null;
  resume_filename: string | null;
}

export const EMPTY_CONTEXT: InterviewContext = {
  round: null,
  target_role: null,
  resume_text: null,
  resume_filename: null,
};

export interface InterviewSession {
  /** Empty when the interview is driven by the resume instead of a named topic. */
  topic: string;
  difficulty: Difficulty;
  context: InterviewContext;
  messages: Message[];
  over: boolean;
}

export type Band = "excellent" | "good" | "adequate" | "weak";

export interface Report {
  score: number;
  band: Band;
  result: "Pass" | "Fail";
  strengths: string[];
  weaknesses: string[];
  topics_to_revise: string[];
  verdict: string;
  preparation_tips: string[];
}

/** Human-readable title for a session: the topic, or a resume-driven label. */
export function sessionTitle(session: Pick<InterviewSession, "topic" | "context">): string {
  if (session.topic) return session.topic;
  const round = session.context.round ? `${session.context.round} interview` : "Technical interview";
  return session.context.target_role ? `${round} · ${session.context.target_role}` : `${round} from your resume`;
}
