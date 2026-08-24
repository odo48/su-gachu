/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // necesar pentru Docker
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.openfoodfacts.org' }],
  },
  // jarvis-brain se conectează la /_mcp — îl mapăm la /api/mcp
  async rewrites() {
    return [
      { source: '/_mcp', destination: '/api/mcp' },
    ];
  },
};
export default nextConfig;
