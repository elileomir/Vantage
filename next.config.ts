import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't let an ESLint rule fail the production build on Vercel (TypeScript checks still run).
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
