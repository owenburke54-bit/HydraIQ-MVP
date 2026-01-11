import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const outPath = "public/version.json";
mkdirSync(dirname(outPath), { recursive: true });

// Use Vercel commit SHA if available; otherwise fallback to timestamp
const version =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  String(Date.now());

writeFileSync(outPath, JSON.stringify({ version }, null, 2), "utf8");
console.log("Wrote", outPath, "version:", version);
