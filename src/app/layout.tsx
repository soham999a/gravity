import type { Metadata } from "next";
import { Instrument_Serif, Inter_Tight, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/studio/toast";
import { AuthCookieSync } from "@/components/auth/AuthCookieSync";
import "./globals.css";

const instrument = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument",
  weight: ["400"],
  style: ["normal", "italic"],
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  weight: ["300", "400", "500"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "GRAVITY Studio — Intelligence, assembled.",
  description:
    "A simple surface for creating, analyzing, and deciding. State an intent — GRAVITY assembles the right intelligence behind it.",
  metadataBase: new URL("https://gravity.matrka.net"),
  openGraph: {
    title: "GRAVITY Studio — Intelligence, assembled.",
    description: "State an intent — GRAVITY assembles the right intelligence behind it.",
    url: "https://gravity.matrka.net",
    siteName: "GRAVITY Studio",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport = { themeColor: "#080808" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${instrument.variable} ${interTight.variable} ${plexMono.variable}`}
    >
      {/* suppressHydrationWarning: browser extensions (Grammarly etc.) inject
          attributes like data-gr-ext-installed into <body> before React
          hydrates, causing a false-positive hydration mismatch. */}
      <body className="min-h-screen" suppressHydrationWarning>
        {/* Refreshes the fb-token cookie on every Firebase token rotation —
            without it sessions die 401 exactly one hour after login. */}
        <AuthCookieSync />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
