import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root so Next.js does not pick up an unrelated parent lockfile.
  turbopack: {
    root: fileURLToPath(new URL('./', import.meta.url)),
  },
};

export default nextConfig;
