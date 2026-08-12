import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Passage — answers, cited to the exact passage",
    template: "%s · Passage",
  },
  description:
    "Ask a question in plain language and get back the literal passage it came from - real hybrid retrieval, not a paraphrase you have to take on faith.",
  openGraph: {
    title: "Passage — answers, cited to the exact passage",
    description: "Every answer is the source text itself, with a citation, or an honest refusal.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-ink-950 font-sans text-ink-200 antialiased">{children}</body>
    </html>
  );
}
