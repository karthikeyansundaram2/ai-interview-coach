import type { Metadata } from "next";
import { InterviewApp } from "@/components/InterviewApp";

export const metadata: Metadata = { title: "Interview" };

export default function InterviewPage() {
  return <InterviewApp />;
}
