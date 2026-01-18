export const metadata = {
  title: "Data Deletion • HydraIQ",
  description: "How to delete your HydraIQ data.",
};

export default function DataDeletionPage() {
  return (
    <main className="px-4 pb-6 pt-[calc(72px+env(safe-area-inset-top))]">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold">Data Deletion</h1>

        <section className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Local app data</h2>
          <p>
            To delete hydration logs and settings stored on this device, go to{" "}
            <span className="font-medium">Profile → Reset data</span>. This clears local data immediately.
          </p>
        </section>

        <section className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Account data</h2>
          <p>
            If you created an account and want server-side data deleted, email{" "}
            <a className="underline" href="mailto:support@hydraiq.app">
              support@hydraiq.app
            </a>{" "}
            from the email linked to your account.
          </p>
        </section>
      </div>
    </main>
  );
}

