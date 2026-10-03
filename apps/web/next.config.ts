import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // unsafe-inline remains for Next hydration and the theme script; removing it requires nonces.
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"} https://js.stripe.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      { source: "/connexion", destination: "/mon-compte", permanent: true },
      { source: "/inscription", destination: "/mon-compte", permanent: true },
      { source: "/contact", destination: "/atelier", permanent: false },
      { source: "/sos", destination: "/urgence", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: process.env.NEXT_PUBLIC_BRAND_DOMAIN || "trottistore.fr" },
      { protocol: "https", hostname: `www.${process.env.NEXT_PUBLIC_BRAND_DOMAIN || "trottistore.fr"}` },
      { protocol: "https", hostname: "wattiz.fr" }, // Supplier images
      { protocol: "https", hostname: "www.wattiz.fr" },
      { protocol: "http", hostname: "localhost", port: "9001" }, // MinIO dev
    ],
  },
  async rewrites() {
    const ecommerce = process.env.API_URL || "http://localhost:3001";
    const crm = process.env.API_CRM_URL || `http://localhost:${process.env.PORT_CRM || "3002"}`;
    const analytics = process.env.API_ANALYTICS_URL || `http://localhost:${process.env.PORT_ANALYTICS || "3003"}`;
    const sav = process.env.API_SAV_URL || `http://localhost:${process.env.PORT_SAV || "3004"}`;

    return [
      // Ecommerce
      { source: "/api/v1/products/:path*", destination: `${ecommerce}/api/v1/products/:path*` },
      { source: "/api/v1/categories/:path*", destination: `${ecommerce}/api/v1/categories/:path*` },
      { source: "/api/v1/orders/:path*", destination: `${ecommerce}/api/v1/orders/:path*` },
      { source: "/api/v1/cart/:path*", destination: `${ecommerce}/api/v1/cart/:path*` },
      { source: "/api/v1/cart", destination: `${ecommerce}/api/v1/cart` },
      { source: "/api/v1/auth/:path*", destination: `${ecommerce}/api/v1/auth/:path*` },
      { source: "/api/v1/admin/:path*", destination: `${ecommerce}/api/v1/admin/:path*` },
      { source: "/api/v1/stock/:path*", destination: `${ecommerce}/api/v1/stock/:path*` },
      { source: "/api/v1/stock-alerts", destination: `${ecommerce}/api/v1/stock-alerts` },
      { source: "/api/v1/checkout/:path*", destination: `${ecommerce}/api/v1/checkout/:path*` },
      { source: "/api/v1/addresses/:path*", destination: `${ecommerce}/api/v1/addresses/:path*` },
      { source: "/api/v1/addresses", destination: `${ecommerce}/api/v1/addresses` },
      { source: "/api/v1/reviews/:path*", destination: `${ecommerce}/api/v1/reviews/:path*` },
      { source: "/api/v1/reviews", destination: `${ecommerce}/api/v1/reviews` },
      { source: "/api/v1/leads/:path*", destination: `${ecommerce}/api/v1/leads/:path*` },
      { source: "/api/v1/merchant/:path*", destination: `${ecommerce}/api/v1/merchant/:path*` },
      // CRM
      { source: "/api/v1/customers/:path*", destination: `${crm}/api/v1/customers/:path*` },
      { source: "/api/v1/campaigns/:path*", destination: `${crm}/api/v1/campaigns/:path*` },
      { source: "/api/v1/segments/:path*", destination: `${crm}/api/v1/segments/:path*` },
      { source: "/api/v1/triggers/:path*", destination: `${crm}/api/v1/triggers/:path*` },
      { source: "/api/v1/newsletter/:path*", destination: `${crm}/api/v1/newsletter/:path*` },
      // Analytics
      { source: "/api/v1/analytics/:path*", destination: `${analytics}/api/v1/analytics/:path*` },
      // SAV
      { source: "/api/v1/repairs/:path*", destination: `${sav}/api/v1/repairs/:path*` },
      { source: "/api/v1/appointments/:path*", destination: `${sav}/api/v1/appointments/:path*` },
      { source: "/api/v1/technicians/:path*", destination: `${sav}/api/v1/technicians/:path*` },
    ];
  },
};

export default nextConfig;
