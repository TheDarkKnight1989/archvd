import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  async redirects() {
    return [
      {
        source: '/portfolio/market/:path*',
        destination: '/portfolio?openSearch=true',
        permanent: true, // 301 redirect
      },
    ];
  },
};

export default nextConfig;
