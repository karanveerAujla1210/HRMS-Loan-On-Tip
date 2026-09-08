import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {},
  transpilePackages: ["@hrms/api-contract", "@hrms/domain", "@hrms/config", "@hrms/ui-tokens"],
};

export default nextConfig;