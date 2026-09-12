import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@hrms/api-contract", "@hrms/domain", "@hrms/config", "@hrms/ui-tokens"],
};

export default nextConfig;