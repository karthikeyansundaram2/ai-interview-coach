import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/SiteHeader";
import { ContinueLink, DoneDot, ProgressCount } from "@/components/track/TrackClient";
import { TrackTabs } from "@/components/track/TrackHeader";
import { TRACK_SLUGS, flatLessons, getTrack, trackStats } from "@/lib/content/load";

export const dynamicParams = false;
export function generateStaticParams() {
  return TRACK_SLUGS.map((track) => ({ track }));
}
export async function generateMetadata({ params }: { params: Promise<{ track: string }> }): Promise<Metadata> {
  const t = getTrack((await params).track);
  return t ? { title: t.name, description: t.tagline } : {};
}

export default async function TrackPage({ params }: { params: Promise<{ track: string }> }) {
  const track = getTrack((await params).track);
  if (!track) notFound();
  const stats = trackStats(track);
  const lessons = flatLessons(track);
  const ids = lessons.map((l) => `${track.slug}:${l.slug}`);
  let moduleNo = 0;

  return (
    <PageShell>
      <section className="relative overflow-hidden border-b border-border">
        <div className="ruled pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-6xl px-5 pt-14 pb-12 lg:pt-20">
          <p className="eyebrow text-accent">{track.slug.toUpperCase()} track</p>
          <h1 className="display mt-4 text-[clamp(2.5rem,7vw,5rem)]">{track.name}</h1>
          <p className="mt-5 max-w-2xl text-xl leading-relaxed text-fg/90">{track.tagline}</p>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted">{track.intro}</p>
          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3 font-mono">
            <Stat n={track.stages.length} l="stages" />
            <Stat n={stats.modules} l="modules" />
            <Stat n={stats.lessons} l="lessons" />
            <Stat n={stats.practice} l={track.slug === "ai" ? "projects" : "problems"} />
            <Stat n={Math.round(stats.minutes / 60)} l="hours" />
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <ContinueLink
              fallbackLabel="Start the first lesson"
              items={lessons.map((l) => ({ id: `${track.slug}:${l.slug}`, href: `/${track.slug}/learn/${l.slug}`, title: l.title }))}
            />
            <ProgressCount ids={ids} label="lessons" />
          </div>
        </div>
      </section>
      <TrackTabs track={track} active="learn" />

      <div className="mx-auto w-full max-w-6xl px-5 py-12">
        {track.stages.map((stage, si) => (
          <section key={stage.name} className="mb-16 last:mb-0">
            <div className="mb-6 grid gap-3 border-b border-border pb-5 lg:grid-cols-[auto_1fr] lg:items-end lg:gap-8">
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-sm text-accent">Stage {si + 1}</span>
                <h2 className="display text-3xl sm:text-4xl">{stage.name}</h2>
              </div>
              <p className="max-w-2xl text-muted lg:justify-self-end lg:text-right">{stage.blurb}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {stage.modules.map((m) => {
                moduleNo++;
                return (
                  <div key={m.slug} className="flex min-w-0 flex-col border border-border bg-bg">
                    <div className="border-b border-border px-5 py-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-mono text-xs text-faint">Module {String(moduleNo).padStart(2, "0")}</span>
                        <span className="font-mono text-[11px] text-faint">
                          {m.lessons.length} lessons · {m.lessons.reduce((n, l) => n + l.minutes, 0)} min
                        </span>
                      </div>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight">{m.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted">{m.outcome}</p>
                    </div>
                    <ol className="flex-1 divide-y divide-border">
                      {m.lessons.map((l) => (
                        <li key={l.slug}>
                          <Link href={`/${track.slug}/learn/${l.slug}`} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface">
                            <DoneDot id={`${track.slug}:${l.slug}`} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-medium text-fg group-hover:text-accent">{l.title}</span>
                              <span className="block truncate text-xs text-faint">{l.summary}</span>
                            </span>
                            <span className="shrink-0 font-mono text-[11px] text-faint">{l.minutes}m</span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <div className="mt-6 flex flex-col items-start justify-between gap-4 border border-border bg-surface p-6 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow text-accent">Then practise</p>
            <p className="mt-2 text-lg font-semibold">{track.practiceLabel}</p>
            <p className="mt-1 max-w-xl text-sm text-muted">{track.practiceIntro}</p>
          </div>
          <Link href={`/${track.slug}/practice`} className="underline-cta shrink-0">
            Open {track.practiceLabel.toLowerCase()} →
          </Link>
        </div>
      </div>
    </PageShell>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div>
      <span className="text-3xl font-semibold tabular-nums text-fg">{n}</span>
      <span className="ml-2 text-xs uppercase tracking-widest text-faint">{l}</span>
    </div>
  );
}
