import type { Metadata, Viewport } from "next";
import { Inter_Tight, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { SITE_NAME } from "@/lib/site";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["italic"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} — DSA patterns, system design, AI & mock interviews`, template: `%s · ${SITE_NAME}` },
  description:
    "Learn DSA by pattern with step-through visualizers, low-level and system design, AI engineering, and practise with an AI mock interviewer.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${interTight.variable} ${jetbrains.variable} ${playfair.variable}`}>
      <body className="min-h-dvh bg-bg text-fg">{children}</body>
    </html>
  );
}
