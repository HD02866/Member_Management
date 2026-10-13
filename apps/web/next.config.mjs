/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Prevent premature chunk load timeouts during initial development compilation on Windows
      config.output.chunkLoadTimeout = 300000;
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: 'http://localhost:3000/api/v1/uploads/:path*',
      },
    ];
  },
};

export default nextConfig;
