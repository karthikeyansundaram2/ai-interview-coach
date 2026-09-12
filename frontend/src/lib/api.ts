import type { Difficulty, InterviewContext, Message, Report, Resume } from "./types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError(
      "Couldn't reach the server. Make sure the backend is running on " + API_URL + ".",
      0,
    );
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status}).`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") detail = data.detail;
    } catch {
      /* non-JSON error body — keep the default message */
    }
    throw new ApiError(detail, res.status);
  }
  return (await res.json()) as T;
}

function post<T>(path: string, body: unknown) {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export interface TurnResponse {
  message: string;
  interview_over: boolean;
}

export function startInterview(topic: string, difficulty: Difficulty, context: InterviewContext) {
  return post<TurnResponse>("/interview/start", { topic, difficulty, context });
}

export function submitAnswer(
  topic: string,
  difficulty: Difficulty,
  messages: Message[],
  answer: string,
  context: InterviewContext,
) {
  return post<TurnResponse>("/interview/answer", { topic, difficulty, messages, answer, context });
}

export function generateReport(
  topic: string,
  difficulty: Difficulty,
  messages: Message[],
  context: InterviewContext,
) {
  return post<Report>("/interview/report", { topic, difficulty, messages, context });
}

export function parseResume(file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<Resume>("/resume/parse", { method: "POST", body: form });
}
