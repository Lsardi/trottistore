import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: process.env.NEXT_PUBLIC_BRAND_DOMAIN || "trottistore.fr" },
      { protocol: "https", hostname: `www.${process.env.NEXT_PUBLIC_BRAND_DOMAIN || "trottistore.fr"}` },
      { protocol: "http", hostname: "localhost", port: "9001" }, // MinIO dev
    ],
  },
  async rewrites() {
    return [
      // Proxy API calls to microservices
      { source: "/api/v1/products/:path*", destination: `${process.env.API_URL || "http://localhost:3001"}/api/v1/products/:path*` },
      { source: "/api/v1/categories/:path*", destination: `${process.env.API_URL || "http://localhost:3001"}/api/v1/categories/:path*` },
      { source: "/api/v1/orders/:path*", destination: `${process.env.API_URL || "http://localhost:3001"}/api/v1/orders/:path*` },
      { source: "/api/v1/customers/:path*", destination: `${process.env.PORT_CRM ? `http://localhost:${process.env.PORT_CRM}` : "http://localhost:3002"}/api/v1/customers/:path*` },
      { source: "/api/v1/analytics/:path*", destination: `${process.env.PORT_ANALYTICS ? `http://localhost:${process.env.PORT_ANALYTICS}` : "http://localhost:3003"}/api/v1/analytics/:path*` },
      { source: "/api/v1/repairs/:path*", destination: `${process.env.PORT_SAV ? `http://localhost:${process.env.PORT_SAV}` : "http://localhost:3004"}/api/v1/repairs/:path*` },
    ];
  },
};

export default nextConfig;
