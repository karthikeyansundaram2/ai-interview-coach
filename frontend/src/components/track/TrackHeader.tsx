import Link from "next/link";
import type { Track } from "@/lib/content/types";

export function TrackTabs({ track, active }: { track: Track; active: "learn" | "practice" }) {
  const tabs = [
    { key: "learn", href: `/${track.slug}`, label: "Learn" },
    { key: "practice", href: `/${track.slug}/practice`, label: track.practiceLabel },
  ] as const;
  return (
    <div className="border-b border-border">
      <nav className="mx-auto flex w-full max-w-6xl gap-1 px-5" aria-label={`${track.name} sections`}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={`relative inline-flex min-h-12 items-center px-3 font-mono text-[13px] transition-colors ${active === t.key ? "text-fg" : "text-muted hover:text-fg"}`}
          >
            {t.label}
            {active === t.key && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-accent" />}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export const LEVEL_TONE: Record<string, string> = { Easy: "text-good border-good/40", Medium: "text-okay border-okay/40", Hard: "text-weak border-weak/40" };
