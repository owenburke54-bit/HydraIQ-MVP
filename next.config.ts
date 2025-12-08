import type { NextConfig } from "next";

const nextConfig = {
  turbopack: {
    // Ensure the project root is this HydraIQ folder to avoid parent lockfile confusion
    root: __dirname,
  },
} as unknown as NextConfig;

export default nextConfig;
