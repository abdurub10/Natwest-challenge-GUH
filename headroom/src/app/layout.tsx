import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { PREFS_BOOT_SCRIPT } from "@/lib/client/prefs";
import "./globals.css";

// Space Grotesk for display and UI; IBM Plex Mono for numbered labels and metadata (ui-plan.md 3.3).
// The CSS variables feed --font-serif / --font-sans / --font-mono in globals.css.
const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Headroom",
  description: "Your money, 90 days ahead, in plain English, with a plan.",
  applicationName: "Headroom",
  appleWebApp: { capable: true, title: "Headroom", statusBarStyle: "black" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#10110F",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-text-size="normal" className={`${display.variable} ${plexMono.variable} antialiased`} suppressHydrationWarning>
      <head>
        {/* Apply the saved text size and language before first paint (no flash of normal text). */}
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-canvas font-sans text-ink">{children}</body>
    </html>
  );
}
