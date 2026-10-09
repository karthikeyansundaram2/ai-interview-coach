import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { PageShell } from "@/components/SiteHeader";
import { MarkComplete, Reveal } from "@/components/track/TrackClient";
import { LEVEL_TONE } from "@/components/track/TrackHeader";
import { IconArrowRight } from "@/components/icons";
import { TRACKS, getPracticeBody, getTrack } from "@/lib/content/load";

export const dynamicParams = false;
export function generateStaticParams() {
  return Object.values(TRACKS).flatMap((t) => t.practice.map((p) => ({ track: t.slug, slug: p.slug })));
}
export async function generateMetadata({ params }: { params: Promise<{ track: string; slug: string }> }): Promise<Metadata> {
  const { track: ts, slug } = await params;
  const t = getTrack(ts);
  const p = t?.practice.find((x) => x.slug === slug);
  return p && t ? { title: `${p.title} · ${t.practiceLabel}`, description: p.summary } : {};
}

/** Split after the first `##` section so the brief stays visible and the solution hides behind Reveal. */
function splitBrief(md: string): [string, string] {
  const lines = md.split("\n");
  let inFence = false;
  let seen = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("```")) inFence = !inFence;
    if (!inFence && lines[i].startsWith("## ")) {
      seen++;
      if (seen === 2) return [lines.slice(0, i).join("\n"), lines.slice(i).join("\n")];
    }
  }
  return [md, ""];
}

const ROUND: Record<string, string> = { lld: "Technical", hld: "System design", ai: "System design" };

export default async function PracticeDetail({ params }: { params: Promise<{ track: string; slug: string }> }) {
  const { track: ts, slug } = await params;
  const track = getTrack(ts);
  const p = track?.practice.find((x) => x.slug === slug);
  const body = track && getPracticeBody(track.slug, slug);
  if (!track || !p || !body) notFound();
  const isProject = track.slug === "ai";
  const [brief, solution] = isProject ? [body, ""] : splitBrief(body);
  const idx = track.practice.indexOf(p);
  const next = track.practice[idx + 1];

  return (
    <PageShell>
      <article className="mx-auto w-full max-w-3xl px-5 py-10 lg:py-14">
        <nav className="font-mono text-xs text-faint" aria-label="Breadcrumb">
          <Link href={`/${track.slug}`} className="hover:text-fg">{track.slug.toUpperCase()}</Link>
          <span className="mx-1.5">/</span>
          <Link href={`/${track.slug}/practice`} className="hover:text-fg">{track.practiceLabel}</Link>
        </nav>
        <h1 className="display mt-5 text-[clamp(2rem,5vw,3.5rem)]">{p.title}</h1>
        <p className="mt-4 text-lg text-muted">{p.summary}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className={`eyebrow border px-1.5 py-0.5 ${LEVEL_TONE[p.level]}`}>{p.level}</span>
          <span className="font-mono text-xs text-faint">{p.minutes} min</span>
          {p.concepts.map((c) => (
            <span key={c} className="border border-border px-1.5 py-0.5 font-mono text-[10.5px] text-faint">
              {c}
            </span>
          ))}
        </div>

        <div className="mt-10 border-t border-border pt-8">
          <Markdown source={brief} />
          {solution && (
            <Reveal minutes={p.minutes}>
              <div className="mt-10 border-t-2 border-accent pt-2">
                <p className="eyebrow mb-6 text-accent">Reference solution</p>
                <Markdown source={solution} />
              </div>
            </Reveal>
          )}
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-border pt-8">
          <MarkComplete id={`${track.slug}-practice:${slug}`} nextHref={next ? `/${track.slug}/practice/${next.slug}` : undefined} />
          {!isProject && (
            <div className="flex flex-col items-start justify-between gap-4 border border-border bg-surface p-5 sm:flex-row sm:items-center">
              <div>
                <p className="font-semibold">Defend it out loud</p>
                <p className="mt-1 text-sm text-muted">The AI interviewer will probe your design for {p.title} and score it.</p>
              </div>
              <Link
                href={`/interview?topic=${encodeURIComponent(`Design ${p.title}`)}&difficulty=${p.level === "Easy" ? "Medium" : "Hard"}&round=${encodeURIComponent(ROUND[track.slug])}`}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 bg-accent px-5 text-sm font-semibold text-accent-fg hover:bg-accent-strong"
              >
                Mock interview <IconArrowRight className="size-4" />
              </Link>
            </div>
          )}
        </div>
      </article>
    </PageShell>
  );
}
