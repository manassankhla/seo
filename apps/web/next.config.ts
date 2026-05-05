import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@freecrawl/core", "@freecrawl/db-mongodb", "@freecrawl/shared-types"]
};

export default nextConfig;
