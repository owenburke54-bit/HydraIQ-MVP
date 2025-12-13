export const metadata = {
	title: "Privacy Policy • HydraIQ",
	description:
		"How HydraIQ collects, uses, and protects your data, including WHOOP data.",
};

export default function PrivacyPage() {
	return (
		<main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" }}>
			<h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "1rem" }}>
				HydraIQ Privacy Policy
			</h1>
			<p style={{ color: "#555", marginBottom: "1.5rem" }}>
				Last updated: {new Date().toISOString().slice(0, 10)}
			</p>

			<section style={{ marginBottom: "1.5rem" }}>
				<h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: ".5rem" }}>
					Overview
				</h2>
				<p style={{ lineHeight: 1.7 }}>
					HydraIQ helps you estimate hydration needs and track intake. We take
					your privacy seriously. This page explains what we collect, how we use it,
					and the choices you have.
				</p>
			</section>

			<section style={{ marginBottom: "1.5rem" }}>
				<h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: ".5rem" }}>
					What we collect
				</h2>
				<ul style={{ paddingLeft: "1.25rem", lineHeight: 1.7 }}>
					<li>
						Account data you provide (for example, email if you sign in).
					</li>
					<li>
						App data you enter (for example, hydration intake, preferences).
					</li>
					<li>
						Optional WHOOP data if you connect your account. This may include activity,
						sleep, recovery, and profile metrics as allowed by WHOOP scopes you approve.
					</li>
					<li>
						Technical data for app functionality and security (for example, logs, device/browser info).
					</li>
				</ul>
			</section>

			<section style={{ marginBottom: "1.5rem" }}>
				<h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: ".5rem" }}>
					How we use data
				</h2>
				<ul style={{ paddingLeft: "1.25rem", lineHeight: 1.7 }}>
					<li>Provide, maintain, and improve HydraIQ features.</li>
					<li>
						Personalize hydration guidance, including using WHOOP data to refine intake targets.
					</li>
					<li>
						Secure authentication and prevent abuse.
					</li>
				</ul>
				<p style={{ lineHeight: 1.7, marginTop: ".5rem" }}>
					We do not sell your personal data.
				</p>
			</section>

			<section style={{ marginBottom: "1.5rem" }}>
				<h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: ".5rem" }}>
					WHOOP connection and tokens
				</h2>
				<p style={{ lineHeight: 1.7 }}>
					If you connect WHOOP, we use OAuth to obtain a token so the app can read data
					you approved. You can disconnect at any time, which stops future access. We only
					request the minimum scopes needed for features you use.
				</p>
			</section>

			<section style={{ marginBottom: "1.5rem" }}>
				<h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: ".5rem" }}>
					Data retention
				</h2>
				<p style={{ lineHeight: 1.7 }}>
					We retain data for as long as needed to provide the service and comply with legal
					obligations. You can request deletion of your account data, subject to applicable law.
				</p>
			</section>

			<section style={{ marginBottom: "1.5rem" }}>
				<h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: ".5rem" }}>
					Sharing
				</h2>
				<p style={{ lineHeight: 1.7 }}>
					We share data with service providers that help us run the app (for example, hosting,
					analytics, authentication) under contracts that protect your information. We may
					disclose information to comply with law, enforce our terms, or protect rights, property,
					or safety.
				</p>
			</section>

			<section style={{ marginBottom: "1.5rem" }}>
				<h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: ".5rem" }}>
					Security
				</h2>
				<p style={{ lineHeight: 1.7 }}>
					We use reasonable safeguards to protect your information. However, no method of
					transmission or storage is completely secure.
				</p>
			</section>

			<section style={{ marginBottom: "1.5rem" }}>
				<h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: ".5rem" }}>
					Your choices
				</h2>
				<ul style={{ paddingLeft: "1.25rem", lineHeight: 1.7 }}>
					<li>You can disconnect WHOOP at any time within the app.</li>
					<li>You can request deletion of your account data.</li>
					<li>You can choose not to provide optional information.</li>
				</ul>
			</section>

			<section style={{ marginBottom: "1.5rem" }}>
				<h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: ".5rem" }}>
					Contact
				</h2>
				<p style={{ lineHeight: 1.7 }}>
					If you have questions about this policy or your data, please reach out using the
					contact method provided in the app or on our website.
				</p>
			</section>
		</main>
	);
}


