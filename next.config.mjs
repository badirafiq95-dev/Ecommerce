import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const isDevelopment = process.env.NODE_ENV !== "production";

const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  isDevelopment ? "'unsafe-eval'" : "",
  "https://apis.google.com",
  "https://accounts.google.com",
  "https://www.google.com",
  "https://*.google.com",
  "https://www.gstatic.com",
  "https://*.gstatic.com",
  "https://ssl.gstatic.com",
  "https://www.recaptcha.net",
  "https://recaptcha.google.com"
].filter(Boolean);

const connectSrc = [
  "'self'",
  "https://*.googleapis.com",
  "https://apis.google.com",
  "https://accounts.google.com",
  "https://*.google.com",
  "https://*.firebaseio.com",
  "https://*.firebaseapp.com",
  "https://*.firebasestorage.app",
  "https://securetoken.googleapis.com",
  "https://identitytoolkit.googleapis.com",
  "https://firebaseinstallations.googleapis.com",
  "https://firebaseappcheck.googleapis.com",
  "https://content-firebaseappcheck.googleapis.com",
  "https://firebaselogging-pa.googleapis.com",
  "https://www.googleapis.com",
  "https://www.google.com",
  "https://www.gstatic.com",
  "https://*.gstatic.com",
  "https://ssl.gstatic.com",
  "https://www.recaptcha.net",
  "https://recaptcha.google.com",
  "https://api.postalpincode.in",
  "https://nominatim.openstreetmap.org",
  "https://api.bigdatacloud.net",
  "https://www.google-analytics.com",
  "https://*.google-analytics.com",
  isDevelopment ? "http://localhost:*" : "",
  isDevelopment ? "http://127.0.0.1:*" : "",
  isDevelopment ? "ws://localhost:*" : "",
  isDevelopment ? "ws://127.0.0.1:*" : ""
].filter(Boolean);

const frameSrc = [
  "'self'",
  "https://apis.google.com",
  "https://accounts.google.com",
  "https://*.google.com",
  "https://*.firebaseapp.com",
  "https://www.google.com",
  "https://www.recaptcha.net",
  "https://recaptcha.google.com"
];

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSrc.join(" ")}`,
  `script-src-elem ${scriptSrc.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: https://*.googleusercontent.com https://ssl.gstatic.com",
  "font-src 'self' data:",
  `connect-src ${connectSrc.join(" ")}`,
  `frame-src ${frameSrc.join(" ")}`,
  `child-src ${frameSrc.join(" ")}`,
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com https://*.firebaseapp.com",
  "frame-ancestors 'none'"
].join("; ");

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
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" }
        ]
      }
    ];
  }
};

export default nextConfig;
