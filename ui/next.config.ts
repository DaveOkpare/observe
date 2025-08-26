import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const hasExternal = !!process.env.NEXT_PUBLIC_API_BASE_URL;
    if (hasExternal) return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
