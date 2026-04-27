import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    formats: ["image/avif", "image/webp"]
  },
  turbopack: {
    root
  },
  poweredByHeader: false,
  reactStrictMode: true
};

export default nextConfig;
