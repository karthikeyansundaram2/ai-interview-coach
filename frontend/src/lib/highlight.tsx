import type { ReactNode } from "react";

// Deliberately tiny highlighter: enough colour to make Python/TS skimmable, zero dependencies.
const KW = new Set(
  "def return if elif else for while in not and or is None True False class import from as with try except finally raise lambda yield pass break continue global nonlocal async await self const let var function new interface type export extends implements public private protected static readonly".split(
    " ",
  ),
);
const BUILTIN = new Set("len range enumerate max min sum sorted list dict set tuple print int str float abs any all zip map filter reversed heapq deque defaultdict Counter isinstance super".split(" "));

const REST = /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|(@\w+)|([A-Za-z_]\w*)/.source;

export function highlightLine(line: string, lang = "python"): ReactNode[] {
  if (lang === "text" || lang === "") return [line];
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const comment = lang === "python" || lang === "py" ? "(#.*$)" : "(\\/\\/.*$)";
  const re = new RegExp(`${comment}|${REST}`, "gm");
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const [tok, cmt, str, number, deco, word] = m;
    const key = m.index;
    if (cmt) out.push(<span key={key} className="text-faint italic">{tok}</span>);
    else if (str) out.push(<span key={key} className="text-good">{tok}</span>);
    else if (number) out.push(<span key={key} className="text-okay">{tok}</span>);
    else if (deco) out.push(<span key={key} className="text-violet">{tok}</span>);
    else if (word && KW.has(word)) out.push(<span key={key} className="text-accent">{tok}</span>);
    else if (word && BUILTIN.has(word)) out.push(<span key={key} className="text-info">{tok}</span>);
    else out.push(tok);
    last = m.index + tok.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function CodeBlock({ code, lang = "python", className = "" }: { code: string; lang?: string; className?: string }) {
  const lines = code.replace(/\n$/, "").split("\n");
  const hl = ["python", "py", "ts", "typescript", "js", "javascript", "tsx", "java", "go"].includes(lang);
  return (
    <div className={`my-5 border border-border-strong bg-surface ${className}`}>
      {lang && lang !== "text" && (
        <div className="border-b border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-faint">{lang}</div>
      )}
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-fg">
        <code>
          {lines.map((l, i) => (
            <span key={i} className="block min-h-[1.4em]">
              {hl ? highlightLine(l, lang === "py" ? "python" : lang) : l}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
