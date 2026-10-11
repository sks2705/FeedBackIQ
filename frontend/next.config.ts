import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    const configuredBackendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    // Accept a value pasted as `BACKEND_URL=https://...` in addition to the
    // expected URL-only value, then validate the normalized URL strictly.
    const rawBackendUrl = configuredBackendUrl.replace(/^BACKEND_URL=/, '');
    let backendUrl: string;
    try {
      const parsedBackendUrl = new URL(rawBackendUrl);
      if (parsedBackendUrl.protocol !== 'http:' && parsedBackendUrl.protocol !== 'https:') {
        throw new Error('unsupported protocol');
      }
      backendUrl = rawBackendUrl.replace(/\/$/, '');
    } catch {
      throw new Error('BACKEND_URL must be an absolute http:// or https:// URL');
    }
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
