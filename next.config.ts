import type { NextConfig } from "next";

// A local verification build (`pnpm build:check`) writes to its own folder so it
// never collides with a running `pnpm dev` server, which owns `.next`.
// `pnpm build` (used by Vercel) is left untouched on the default `.next`.
const isVerifyBuild = process.env.npm_lifecycle_event === "build:check";

const nextConfig: NextConfig = {
  distDir: isVerifyBuild ? ".next-verify" : ".next",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  experimental: {
    // Profile-photo uploads pass through server actions as FormData.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
