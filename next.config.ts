import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack to the repo root: the repo lives inside OneDrive, and a
  // stray parent package-lock.json made Turbopack traverse outside the repo
  // (Windows error 1450 during parallel source-map reads).
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ["firebase-admin"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
