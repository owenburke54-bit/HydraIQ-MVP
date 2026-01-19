import Link from "next/link";
import { Droplet, User } from "lucide-react";
import TopBarClient from "./TopBarClient";

export default function TopBar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 glass bg-white/70 dark:bg-black/30 border-b border-zinc-200/50 dark:border-zinc-800/40 shadow-[var(--shadow-sm)] backdrop-saturate-150">
      <div className="mx-auto max-w-[420px] px-4 pt-2 pb-3">
        {/* Top row */}
        <div className="flex h-8 items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplet size={18} className="text-blue-600" />
            <span className="text-sm font-semibold tracking-wide text-zinc-800 dark:text-zinc-200">
              HydraIQ
            </span>
          </div>

          <Link
            href="/profile"
            aria-label="Profile"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-transform hover:scale-105 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <User size={16} />
          </Link>
        </div>

        {/* Date switcher */}
        <div className="mt-2">
          <TopBarClient />
        </div>
      </div>
    </header>
  );
}
