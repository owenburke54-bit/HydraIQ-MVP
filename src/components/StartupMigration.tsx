"use client";

import { useEffect } from "react";
import { idbGet, idbKeys, idbSet } from "../lib/idb";

const KEYS = ["hydra.profile", "hydra.intakes", "hydra.workouts", "hydra.summaries", "hydra.supplements", "hydra.settings"];

export default function StartupMigration() {
	useEffect(() => {
		(async () => {
			try {
				// Mirror localStorage -> IDB for durability
				for (const k of KEYS) {
					const ls = localStorage.getItem(k);
					if (ls != null) {
						await idbSet(k, ls);
					}
				}
				// If any key missing in localStorage but present in IDB, hydrate LS
				const all = await idbKeys();
				for (const k of all) {
					if (KEYS.includes(k) && localStorage.getItem(k) == null) {
						const v = await idbGet(k);
						if (v != null) localStorage.setItem(k, v);
					}
				}
			} catch {
				// ignore
			}
		})();
	}, []);
	return null;
}


