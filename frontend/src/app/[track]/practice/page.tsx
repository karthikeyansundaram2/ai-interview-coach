import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/SiteHeader";
import { DoneDot, ProgressCount } from "@/components/track/TrackClient";
import { LEVEL_TONE, TrackTabs } from "@/components/track/TrackHeader";
import { TRACK_SLUGS, getTrack } from "@/lib/content/load";

export const dynamicParams = false;
export function generateStaticParams() {
  return TRACK_SLUGS.map((track) => ({ track }));
}
export async function generateMetadata({ params }: { params: Promise<{ track: string }> }): Promise<Metadata> {
  const t = getTrack((await params).track);
  return t ? { title: `${t.practiceLabel} · ${t.name}` } : {};
}

const ORDER = { Easy: 0, Medium: 1, Hard: 2 } as const;

export default async function PracticePage({ params }: { params: Promise<{ track: string }> }) {
  const track = getTrack((await params).track);
  if (!track) notFound();
  const items = [...track.practice].sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  return (
    <PageShell>
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-5 pt-12 pb-10">
          <nav className="font-mono text-xs text-faint">
            <Link href={`/${track.slug}`} className="hover:text-fg">{track.name}</Link> <span className="mx-1.5">/</span> Practice
          </nav>
          <h1 className="display mt-5 text-[clamp(2.25rem,6vw,4rem)]">{track.practiceLabel}</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">{track.practiceIntro}</p>
          <div className="mt-6">
            <ProgressCount ids={items.map((p) => `${track.slug}-practice:${p.slug}`)} label="done" />
          </div>
        </div>
      </section>
      <TrackTabs track={track} active="practice" />
      <div className="mx-auto w-full max-w-6xl px-5 py-10">
        {(["Easy", "Medium", "Hard"] as const).map((lvl) => {
          const group = items.filter((p) => p.level === lvl);
          if (!group.length) return null;
          return (
            <section key={lvl} className="mb-10">
              <h2 className={`eyebrow mb-3 ${LEVEL_TONE[lvl].split(" ")[0]}`}>
                {lvl} · {group.length}
              </h2>
              <div className="grid gap-px border border-border bg-border md:grid-cols-2">
                {group.map((p) => (
                  <Link key={p.slug} href={`/${track.slug}/practice/${p.slug}`} className="group flex gap-4 bg-bg p-5 transition-colors hover:bg-surface">
                    <DoneDot id={`${track.slug}-practice:${p.slug}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-semibold tracking-tight group-hover:text-accent">{p.title}</p>
                        <span className="shrink-0 font-mono text-[11px] text-faint">{p.minutes} min</span>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {p.concepts.map((c) => (
                          <span key={c} className="border border-border px-1.5 py-0.5 font-mono text-[10.5px] text-faint">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
