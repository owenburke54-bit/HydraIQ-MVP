import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const outPath = "public/version.json";
mkdirSync(dirname(outPath), { recursive: true });

// ✅ Must change every deploy, even if the same commit is redeployed.
const version =
  process.env.VERCEL_DEPLOYMENT_ID || // changes every deployment on Vercel
  process.env.VERCEL_BUILD_ID ||       // sometimes available
  process.env.VERCEL_GIT_COMMIT_SHA || // fallback: changes only when commit changes
  String(Date.now());                  // final fallback

writeFileSync(outPath, JSON.stringify({ version }, null, 2), "utf8");
console.log("Wrote", outPath, "version:", version);
