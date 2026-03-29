import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: process.env.NEXT_PUBLIC_BRAND_DOMAIN || "trottistore.fr" },
      { protocol: "https", hostname: `www.${process.env.NEXT_PUBLIC_BRAND_DOMAIN || "trottistore.fr"}` },
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
      // CRM
      { source: "/api/v1/customers/:path*", destination: `${crm}/api/v1/customers/:path*` },
      { source: "/api/v1/campaigns/:path*", destination: `${crm}/api/v1/campaigns/:path*` },
      { source: "/api/v1/segments/:path*", destination: `${crm}/api/v1/segments/:path*` },
      { source: "/api/v1/triggers/:path*", destination: `${crm}/api/v1/triggers/:path*` },
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
