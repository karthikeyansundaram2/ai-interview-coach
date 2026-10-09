import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown, headingsOf } from "@/components/Markdown";
import { PageShell } from "@/components/SiteHeader";
import { DoneDot, MarkComplete } from "@/components/track/TrackClient";
import { TRACKS, flatLessons, getLessonBody, getTrack } from "@/lib/content/load";

export const dynamicParams = false;
export function generateStaticParams() {
  return Object.values(TRACKS).flatMap((t) => flatLessons(t).map((l) => ({ track: t.slug, slug: l.slug })));
}
export async function generateMetadata({ params }: { params: Promise<{ track: string; slug: string }> }): Promise<Metadata> {
  const { track: ts, slug } = await params;
  const t = getTrack(ts);
  const l = t && flatLessons(t).find((x) => x.slug === slug);
  return l ? { title: `${l.title} · ${t.name}`, description: l.summary } : {};
}

export default async function LessonPage({ params }: { params: Promise<{ track: string; slug: string }> }) {
  const { track: ts, slug } = await params;
  const track = getTrack(ts);
  if (!track) notFound();
  const all = flatLessons(track);
  const lesson = all.find((l) => l.slug === slug);
  const body = getLessonBody(track.slug, slug);
  if (!lesson || !body) notFound();
  const prev = all[lesson.index - 1];
  const next = all[lesson.index + 1];
  const toc = headingsOf(body);
  const posInModule = lesson.module.lessons.findIndex((l) => l.slug === slug) + 1;

  return (
    <PageShell>
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 py-10 lg:grid-cols-[15rem_1fr] lg:py-14">
        {/* sidebar */}
        <aside className="order-2 lg:order-1">
          <div className="lg:sticky lg:top-20">
            <Link href={`/${track.slug}`} className="font-mono text-xs text-faint hover:text-fg">
              ← {track.name}
            </Link>
            <p className="eyebrow mt-6 text-faint">{lesson.stage.name}</p>
            <p className="mt-1 font-semibold">{lesson.module.title}</p>
            <ol className="mt-3 border-l border-border">
              {lesson.module.lessons.map((l) => {
                const active = l.slug === slug;
                return (
                  <li key={l.slug}>
                    <Link
                      href={`/${track.slug}/learn/${l.slug}`}
                      className={`-ml-px flex items-center gap-2.5 border-l-2 py-2 pl-3 text-sm transition-colors ${active ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"}`}
                    >
                      <DoneDot id={`${track.slug}:${l.slug}`} />
                      <span className="min-w-0 truncate">{l.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            {toc.length > 0 && (
              <div className="mt-8 hidden lg:block">
                <p className="eyebrow text-faint">In this lesson</p>
                <ul className="mt-3 space-y-1.5">
                  {toc.map((h) => (
                    <li key={h.id}>
                      <a href={`#${h.id}`} className="text-[13px] text-muted hover:text-fg">
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>

        {/* content */}
        <article className="order-1 min-w-0 lg:order-2">
          <nav className="font-mono text-xs text-faint" aria-label="Breadcrumb">
            <Link href={`/${track.slug}`} className="hover:text-fg">{track.slug.toUpperCase()}</Link>
            <span className="mx-1.5">/</span>
            {lesson.module.title}
            <span className="mx-1.5">/</span>
            {posInModule} of {lesson.module.lessons.length}
          </nav>
          <h1 className="display mt-5 text-[clamp(2rem,5vw,3.5rem)]">{lesson.title}</h1>
          <p className="mt-4 max-w-3xl text-lg text-muted">{lesson.summary}</p>
          <p className="mt-4 font-mono text-xs text-faint">{lesson.minutes} min read · lesson {lesson.index + 1} of {all.length}</p>
          <div className="mt-10 max-w-3xl border-t border-border pt-8">
            <Markdown source={body} />
          </div>

          <div className="mt-14 max-w-3xl border-t border-border pt-8">
            <MarkComplete id={`${track.slug}:${slug}`} nextHref={next ? `/${track.slug}/learn/${next.slug}` : undefined} />
          </div>

          <nav className="mt-10 grid max-w-3xl gap-px border border-border bg-border sm:grid-cols-2" aria-label="Lesson navigation">
            {prev ? (
              <Link href={`/${track.slug}/learn/${prev.slug}`} className="group bg-bg px-5 py-5 transition-colors hover:bg-surface">
                <span className="eyebrow text-faint">← Previous</span>
                <p className="mt-1 font-semibold group-hover:text-accent">{prev.title}</p>
              </Link>
            ) : (
              <span className="bg-bg" />
            )}
            {next ? (
              <Link href={`/${track.slug}/learn/${next.slug}`} className="group bg-bg px-5 py-5 text-right transition-colors hover:bg-surface">
                <span className="eyebrow text-faint">Next →</span>
                <p className="mt-1 font-semibold group-hover:text-accent">{next.title}</p>
              </Link>
            ) : (
              <Link href={`/${track.slug}/practice`} className="group bg-bg px-5 py-5 text-right transition-colors hover:bg-surface">
                <span className="eyebrow text-faint">Track done →</span>
                <p className="mt-1 font-semibold group-hover:text-accent">{track.practiceLabel}</p>
              </Link>
            )}
          </nav>
        </article>
      </div>
    </PageShell>
  );
}
