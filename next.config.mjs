/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // pozele de produse de la Open Food Facts
    remotePatterns: [{ protocol: 'https', hostname: 'images.openfoodfacts.org' }],
  },
};
export default nextConfig;
