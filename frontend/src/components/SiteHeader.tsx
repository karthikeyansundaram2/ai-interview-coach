"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { IconArrowRight } from "@/components/icons";
import { NAV, SITE_NAME } from "@/lib/site";

export function SiteHeader() {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5">
        <Link href="/" className="eyebrow inline-flex min-h-14 items-center gap-2 whitespace-nowrap text-fg" onClick={() => setOpen(false)}>
          <span className="inline-block size-2 bg-accent" aria-hidden="true" />
          {SITE_NAME}
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => {
            const active = path === n.href || path.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`relative inline-flex min-h-14 items-center px-3 font-mono text-[13px] tracking-wide transition-colors ${active ? "text-fg" : "text-muted hover:text-fg"}`}
              >
                {n.label}
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-accent" />}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/interview" className="underline-cta hidden min-h-11 text-sm sm:inline-flex">
            Mock interview <IconArrowRight className="size-4" />
          </Link>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center border border-border-strong font-mono text-xs md:hidden"
            aria-expanded={open}
            aria-label="Menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "✕" : "≡"}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-border md:hidden" aria-label="Mobile">
          {[...NAV, { href: "/interview", label: "Mock interview" }].map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center border-b border-border px-5 font-mono text-sm text-muted hover:text-fg">
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 text-sm sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="eyebrow flex items-center gap-2 text-fg">
            <span className="inline-block size-2 bg-accent" aria-hidden="true" />
            {SITE_NAME}
          </p>
          <p className="mt-3 max-w-xs text-muted">Patterns first, then practice, then a mock interview that grades you honestly.</p>
        </div>
        <div>
          <p className="eyebrow text-faint">Learn</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li><Link className="hover:text-fg" href="/dsa">DSA patterns</Link></li>
            <li><Link className="hover:text-fg" href="/lld">Low-level design</Link></li>
            <li><Link className="hover:text-fg" href="/hld">System design</Link></li>
            <li><Link className="hover:text-fg" href="/ai">AI engineering</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-faint">Practice</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li><Link className="hover:text-fg" href="/dsa/practice">DSA problem bank</Link></li>
            <li><Link className="hover:text-fg" href="/lld/practice">LLD problems</Link></li>
            <li><Link className="hover:text-fg" href="/hld/practice">Design problems</Link></li>
            <li><Link className="hover:text-fg" href="/interview">Mock interview</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto w-full max-w-6xl px-5 py-4 font-mono text-[11px] text-faint">Progress is saved in this browser only.</p>
      </div>
    </footer>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
