"use client";

import { useEffect } from "react";

export default function RegisterSW() {
	useEffect(() => {
		if ("serviceWorker" in navigator) {
			navigator.serviceWorker
				.register("/sw.js")
				.then((reg) => {
					if (process.env.NODE_ENV !== "production") {
						console.log("[PWA] Service worker registered", reg.scope);
					}
				})
				.catch((err) => {
					if (process.env.NODE_ENV !== "production") {
						console.warn("[PWA] Service worker registration failed", err);
					}
				});
		}
	}, []);
	return null;
}


