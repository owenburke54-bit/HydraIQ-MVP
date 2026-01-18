"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Client-side gate that redirects first-time users to /onboarding
 * when no profile is present and onboarding hasn't been completed.
 */
export default function OnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Don't run on server
    let cancelled = false;

    const run = () => {
      if (typeof window === "undefined") return;
      // Skip on auth and onboarding routes
      if (pathname?.startsWith("/onboarding") || pathname?.startsWith("/auth")) return;
      try {
        const hasProfile = !!localStorage.getItem("hydra.profile");
        const done = localStorage.getItem("hydra:onboardingDone") === "1";
        if (!hasProfile && !done && !cancelled) {
          router.replace("/onboarding");
        }
      } catch {
        // ignore
      }
    };

    // Small delay to let StartupMigration mirror IDB→LS on first load
    const t = window.setTimeout(run, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [pathname, router]);

  return null;
}

