/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const securityHeaders = [
      // Strict transport (only enforced over HTTPS, harmless on localhost).
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      // No clickjacking.
      { key: 'X-Frame-Options', value: 'DENY' },
      // Browsers should stop sniffing MIME types.
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // Don't leak full URL on outgoing links.
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // Lock down powerful APIs to what we actually need.
      {
        key: 'Permissions-Policy',
        value: 'geolocation=(), microphone=(), camera=(), interest-cohort=(), payment=()',
      },
    ];
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
