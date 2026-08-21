/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // pdf-parse dynamically loads its own worker script (pdf.worker.mjs)
  // relative to its own package directory at runtime - Next's default
  // webpack bundling rewrites that into a server chunk path that file
  // never actually lands at, so PDF extraction fails in a real production
  // build (`next start`) even though the exact same code works fine
  // under Vitest, which doesn't bundle at all. Excluding it from bundling
  // makes Next require() it straight from node_modules at runtime,
  // keeping its real on-disk layout - and with it, the worker file it
  // looks for - intact. Found by testing document upload against a real
  // `next build` + `next start`, not just the unit tests.
  serverExternalPackages: ["pdf-parse"],
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ["src"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
