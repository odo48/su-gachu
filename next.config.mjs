/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

if (process.env.NODE_ENV === 'production') {
  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  });
}

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['garmin-connect'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.openfoodfacts.org' }, // pozele de produse de la Open Food Facts
      ...(supabaseHostname ? [{ protocol: 'https', hostname: supabaseHostname }] : []), // exercițiile din exercise-images
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/sw.js', headers: [{ key: 'Service-Worker-Allowed', value: '/' }, { key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};
export default nextConfig;
