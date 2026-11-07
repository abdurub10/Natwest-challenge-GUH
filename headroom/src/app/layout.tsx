import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Source_Serif_4 } from "next/font/google";
import { PREFS_BOOT_SCRIPT } from "@/lib/client/prefs";
import "./globals.css";

// Source Serif 4 for the headroom figure and screen titles; Inter for everything else.
// The CSS variables feed --font-serif / --font-sans in globals.css.
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Headroom",
  description: "Your money, 90 days ahead, in plain English, with a plan.",
  applicationName: "Headroom",
  appleWebApp: { capable: true, title: "Headroom", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FBF8F3",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-text-size="normal" className={`${sourceSerif.variable} ${inter.variable} antialiased`} suppressHydrationWarning>
      <head>
        {/* Apply the saved text size and language before first paint (no flash of normal text). */}
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-canvas font-sans text-ink">{children}</body>
    </html>
  );
}
