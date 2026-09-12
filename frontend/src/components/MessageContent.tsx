import type { ReactNode } from "react";

const FENCE_SOURCE = "```([\\w+-]*)\\n?([\\s\\S]*?)```";

/** Renders message text, turning ```fenced``` blocks into code panels. */
export function MessageContent({ text, className = "" }: { text: string; className?: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const fence = new RegExp(FENCE_SOURCE, "g"); // fresh regex per render: no shared lastIndex state
  while ((match = fence.exec(text)) !== null) {
    if (match.index > last) parts.push(<span key={last}>{text.slice(last, match.index)}</span>);
    const lang = match[1];
    const code = match[2].replace(/\n$/, "");
    parts.push(
      <div key={match.index} className="my-2 border border-border-strong bg-surface-2">
        {lang && (
          <div className="border-b border-border px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-faint">
            {lang}
          </div>
        )}
        <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[13px] leading-relaxed text-fg">
          <code>{code}</code>
        </pre>
      </div>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(<span key={last}>{text.slice(last)}</span>);

  return <div className={`whitespace-pre-wrap ${className}`}>{parts}</div>;
}
