export const metadata = {
  title: "Privacy Policy • HydraIQ",
  description: "How HydraIQ collects, uses, and protects your data, including optional WHOOP data.",
};

export default function PrivacyPage() {
  return (
    <main className="px-4 pb-6 pt-[calc(72px+env(safe-area-inset-top))]">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold">HydraIQ Privacy Policy</h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: {new Date().toISOString().slice(0, 10)}</p>

        <section className="mt-6 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Overview</h2>
          <p>
            HydraIQ helps you estimate hydration needs and track intake. This page explains what we collect,
            how we use it, and the choices you have.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">What we collect</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Account data you provide (for example, email if you sign in).</li>
            <li>App data you enter (for example, hydration intake, preferences).</li>
            <li>
              Optional WHOOP data if you connect your account, such as activity, sleep, recovery, and profile
              metrics allowed by WHOOP scopes you approve.
            </li>
            <li>Technical data for app functionality and security (for example, logs, device/browser info).</li>
          </ul>
        </section>

        <section className="mt-6 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">How we use data</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Provide, maintain, and improve HydraIQ features.</li>
            <li>Personalize hydration guidance, including using WHOOP data to refine intake targets.</li>
            <li>Secure authentication and prevent abuse.</li>
          </ul>
          <p>We do not sell your personal data.</p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">WHOOP connection</h2>
          <p>
            If you connect WHOOP, we use OAuth to access only the data you approve. You can disconnect at any
            time, which stops future access.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Offline behavior</h2>
          <p>
            Core logging and viewing recent data works offline. Features that require network access (WHOOP
            sync, cloud history) will be unavailable until you reconnect.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Data retention</h2>
          <p>
            We retain data as long as needed to provide the service and comply with legal obligations. You can
            request deletion of your account data at any time.
          </p>
        </section>

        <section className="mt-6 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Your choices</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>You can disconnect WHOOP at any time within the app.</li>
            <li>You can request deletion of your account data.</li>
            <li>You can choose not to provide optional information.</li>
          </ul>
        </section>

        <section className="mt-6 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Contact</h2>
          <p>If you have questions about this policy or your data, contact us at support@hydraiq.app.</p>
        </section>
      </div>
    </main>
  );
}

