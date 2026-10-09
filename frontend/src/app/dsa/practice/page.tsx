import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/SiteHeader";
import { ProblemBank } from "@/components/dsa/ProblemBank";
import { PATTERNS } from "@/content/dsa/patterns";

export const metadata: Metadata = { title: "DSA problem bank" };

export default function DsaPracticePage() {
  const seen = new Set<string>();
  const rows = PATTERNS.flatMap((p) =>
    p.problems
      .filter((q) => (seen.has(q.lc) ? false : (seen.add(q.lc), true)))
      .map((q) => ({ ...q, pattern: p.name, patternSlug: p.slug })),
  );
  return (
    <PageShell>
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-5 pt-12 pb-10">
          <nav className="font-mono text-xs text-faint">
            <Link href="/dsa" className="hover:text-fg">DSA</Link> <span className="mx-1.5">/</span> Practice
          </nav>
          <h1 className="display mt-5 text-[clamp(2.25rem,6vw,4rem)]">Problem bank</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Every problem from every pattern ladder in one place. Filter by pattern or difficulty, and tick off what you&apos;ve solved — it syncs with the pattern pages.
          </p>
        </div>
      </section>
      <div className="mx-auto w-full max-w-6xl px-5 py-10">
        <ProblemBank rows={rows} patterns={PATTERNS.map((p) => ({ slug: p.slug, name: p.name }))} />
      </div>
    </PageShell>
  );
}
