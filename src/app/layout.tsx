import type { Metadata } from "next";
import { Instrument_Serif, Inter_Tight, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/studio/toast";
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${instrument.variable} ${interTight.variable} ${plexMono.variable}`}
    >
      <body className="min-h-screen">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
