/** Core panel — standalone Next.js app, deployable/publishable independently. */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
  },
};

export default nextConfig;
