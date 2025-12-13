"use client";

import Link from "next/link";
import { Droplet, User } from "lucide-react";

export default function TopBar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 glass bg-white/70 dark:bg-black/30 border-b border-zinc-200/50 dark:border-zinc-800/40">
      <div className="mx-auto flex h-14 max-w-[420px] items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Droplet size={18} className="text-blue-600" />
          <span className="text-sm font-semibold tracking-wide text-zinc-800 dark:text-zinc-200">HydraIQ</span>
        </div>
        <Link href="/profile" aria-label="Profile" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-transform hover:scale-105 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
          <User size={16} />
        </Link>
      </div>
    </header>
  );
}

