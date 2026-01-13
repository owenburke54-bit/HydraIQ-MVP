import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import BottomNav from "../components/BottomNav";
import RegisterSW from "../components/RegisterSW";
import StartupMigration from "../components/StartupMigration";
import TopBar from "../components/TopBar";
import { Analytics } from "@vercel/analytics/react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HydraIQ",
  description: "HydraIQ — smart hydration tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        {/* PWA manifest + theme color */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />

        {/* iOS PWA support */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="HydraIQ" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>

      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <RegisterSW />
        <StartupMigration />

        {/* ✅ useSearchParams() consumers (DateSwitcher) must be inside Suspense */}
        <Suspense
          fallback={
            <header className="fixed left-0 right-0 top-0 z-40 border-b border-zinc-200/50 bg-white/70 dark:border-zinc-800/40 dark:bg-black/30">
              <div className="mx-auto h-14 max-w-[420px]" />
            </header>
          }
        >
          <TopBar />
        </Suspense>

        {/* Reserve space for the fixed TopBar + iOS safe area so content isn't hidden underneath */}
        <div className="mx-auto flex min-h-screen max-w-[420px] flex-col text-zinc-900 dark:text-zinc-100">
          <main className="flex-1 overflow-x-hidden px-4 pb-[88px] pt-[calc(56px+env(safe-area-inset-top))]">
            {children}
          </main>
        </div>

        <BottomNav />

        {/* ✅ Vercel Analytics */}
        <Analytics />
      </body>
    </html>
  );
}
