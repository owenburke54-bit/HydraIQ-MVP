"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Droplet, PlusCircle, Activity, Sparkles, User } from "lucide-react";
import { twMerge } from "tailwind-merge";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { isISODate } from "@/lib/selectedDate";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Profile", href: "/profile", icon: User },
  { label: "Home", href: "/", icon: Droplet },
  { label: "Log", href: "/log", icon: PlusCircle },
  { label: "Workouts", href: "/workouts", icon: Activity },
  { label: "Insights", href: "/insights", icon: Sparkles },
];

function readDateParam(): string | null {
  if (typeof window === "undefined") return null;
  const sp = new URLSearchParams(window.location.search);
  const q = sp.get("date");
  return isISODate(q) ? q : null;
}

export function BottomNav() {
  const pathname = usePathname();
  const [dateParam, setDateParam] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setDateParam(readDateParam());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const items = useMemo(() => {
    // Preserve ?date= across navigation if present
    if (!dateParam) return NAV_ITEMS.map((i) => ({ ...i, fullHref: i.href }));

    return NAV_ITEMS.map((i) => {
      // Don’t add date to profile unless you want it there
      if (i.href === "/profile") return { ...i, fullHref: i.href };
      const sp = new URLSearchParams();
      sp.set("date", dateParam);
      return { ...i, fullHref: `${i.href}?${sp.toString()}` };
    });
  }, [dateParam]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-zinc-800 dark:bg-black/80">
      <div className="mx-auto flex max-w-[420px] items-stretch justify-between px-4 pb-[calc(env(safe-area-inset-bottom))] pt-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.fullHref}
              className={twMerge(
                "flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl p-2 text-xs",
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
              aria-label={item.label}
            >
              <Icon
                size={22}
                className={twMerge(
                  "transition-colors",
                  isActive ? "text-blue-600 dark:text-blue-400" : ""
                )}
              />
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
