"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { IconCheck, IconFile, IconUpload, IconX } from "@/components/icons";
import { ErrorBanner, Spinner, Tag } from "@/components/ui";
import { ApiError, parseResume } from "@/lib/api";
import type { Resume } from "@/lib/types";

const ACCEPT = ".pdf,.docx,.txt,.md";
const MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  resume: Resume | null;
  onChange: (resume: Resume | null) => void;
  disabled?: boolean;
}

export function ResumeUpload({ resume, onChange, disabled = false }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file || disabled || uploading) return;
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "docx", "txt", "md"].includes(ext)) {
      return setError("Please upload a PDF, Word (.docx), or plain-text file.");
    }
    if (file.size > MAX_BYTES) return setError("That file is over 5 MB. Please upload a smaller resume.");

    setUploading(true);
    try {
      onChange(await parseResume(file));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't read that file. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files?.[0]);
  }

  if (resume) {
    const profile = resume.profile;
    return (
      <div className="animate-fade-up border border-border-strong bg-surface-2 p-3.5">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center bg-good/15 text-good">
            <IconCheck className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <IconFile className="size-4 shrink-0 text-muted" />
              <span className="truncate text-sm font-medium">{resume.filename}</span>
              <span className="shrink-0 font-mono text-xs text-faint">{resume.word_count.toLocaleString()} words</span>
            </div>
            {profile ? (
              <>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{profile.summary}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Tag tone="accent">{profile.experience_level}</Tag>
                  {profile.key_skills.slice(0, 8).map((s) => (
                    <Tag key={s}>{s}</Tag>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-1.5 text-sm text-muted">
                Attached. The interviewer will use it to tailor questions to your experience.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            aria-label="Remove resume"
            className="grid size-11 shrink-0 place-items-center text-muted transition-colors hover:bg-surface-3 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg disabled:opacity-50"
          >
            <IconX className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  const interactive = !disabled && !uploading;

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (interactive) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border border-dashed transition-colors duration-200 ${
          !interactive
            ? "border-border opacity-60"
            : dragging
              ? "border-accent bg-accent/10"
              : "border-border-strong bg-surface-2 hover:border-fg"
        }`}
      >
        <button
          type="button"
          id={inputId}
          disabled={!interactive}
          onClick={() => inputRef.current?.click()}
          className="flex min-h-24 w-full items-center justify-center gap-3 px-4 py-5 text-left text-sm text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fg disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <Spinner className="size-5 text-accent" />
              <span>Reading your resume…</span>
            </>
          ) : (
            <>
              <div className="grid size-10 shrink-0 place-items-center bg-surface-3 text-accent">
                <IconUpload className="size-5" />
              </div>
              <div>
                <div className="font-medium text-fg">
                  Drop your resume here or <span className="text-accent">browse</span>
                </div>
                <div className="mt-0.5 font-mono text-xs text-faint">PDF · DOCX · TXT · up to 5 MB</div>
              </div>
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          tabIndex={-1}
          aria-hidden="true"
          disabled={!interactive}
          onChange={(e) => void handleFile(e.target.files?.[0])}
          className="sr-only"
        />
      </div>
      {error && (
        <div className="mt-2">
          <ErrorBanner message={error} />
        </div>
      )}
    </div>
  );
}
