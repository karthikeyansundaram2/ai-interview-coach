import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ReactNode } from "react";
import { CodeBlock } from "@/lib/highlight";

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) return textOf((node as { props: { children?: ReactNode } }).props.children);
  return "";
}

export function Markdown({ source }: { source: string }) {
  return (
    <div className="prose-pw">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 id={slugify(textOf(children))} className="mt-12 mb-4 scroll-mt-24 text-2xl font-semibold tracking-tight text-fg first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => <h3 className="mt-8 mb-3 text-lg font-semibold tracking-tight text-fg">{children}</h3>,
          h4: ({ children }) => <h4 className="mt-6 mb-2 font-semibold text-fg">{children}</h4>,
          p: ({ children }) => <p className="my-4 text-[16px] leading-[1.75] text-fg/85">{children}</p>,
          ul: ({ children }) => <ul className="my-4 space-y-2 pl-0">{children}</ul>,
          ol: ({ children }) => <ol className="my-4 list-decimal space-y-2 pl-6 marker:font-mono marker:text-sm marker:text-accent">{children}</ol>,
          li: ({ children }) => (
            <li className="relative pl-5 text-[16px] leading-[1.7] text-fg/85 [ol>&]:pl-1">
              <span className="absolute top-[0.7em] left-0 size-1.5 bg-accent [ol>li>&]:hidden" aria-hidden="true" />
              {children}
            </li>
          ),
          strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
          em: ({ children }) => <em className="text-fg">{children}</em>,
          a: ({ href, children }) => (
            <a href={href} className="text-fg underline decoration-accent decoration-2 underline-offset-4 hover:text-accent" target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
              {children}
            </a>
          ),
          blockquote: ({ children }) => <blockquote className="my-6 border-l-2 border-accent bg-surface px-5 py-1 text-muted">{children}</blockquote>,
          hr: () => <hr className="my-10 border-border" />,
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto border border-border">
              <table className="w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-surface-2">{children}</thead>,
          th: ({ children }) => <th className="border-b border-border px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-muted">{children}</th>,
          td: ({ children }) => <td className="border-b border-border px-3 py-2 align-top text-fg/85">{children}</td>,
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const match = /language-([\w+-]+)/.exec(className ?? "");
            const raw = String(children ?? "");
            if (match || raw.includes("\n")) return <CodeBlock code={raw} lang={match?.[1] ?? "text"} />;
            return <code className="border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[0.86em] text-fg">{children}</code>;
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

export function headingsOf(source: string): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  let inFence = false;
  for (const line of source.split("\n")) {
    if (line.startsWith("```")) inFence = !inFence;
    if (!inFence && line.startsWith("## ")) {
      const t = line.slice(3).replace(/[`*_]/g, "").trim();
      out.push({ id: slugify(t), text: t });
    }
  }
  return out;
}

/** Inline-only markdown: `code`, **bold**, *italic*. For short strings in cards and bullets. */
export function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("`") && p.endsWith("`") && p.length > 1)
          return (
            <code key={i} className="border border-border bg-surface-2 px-1 py-px font-mono text-[0.86em] text-fg">
              {p.slice(1, -1)}
            </code>
          );
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold text-fg">{p.slice(2, -2)}</strong>;
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
        return p;
      })}
    </>
  );
}
