/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@hrms/api-contract", "@hrms/domain", "@hrms/ui-tokens"],
};

module.exports = nextConfig;
