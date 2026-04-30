/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    // Tight Content-Security-Policy.
    //   - script-src 'self' + 'unsafe-inline' is required for the Next.js
    //     hydration bootstrap and our pre-paint theme script. We avoid eval.
    //   - connect-src whitelists the Google Generative Language endpoint so
    //     the Calories page can call Gemini directly from the browser.
    //   - default-src 'self' blocks every other surface.
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://generativelanguage.googleapis.com https://api.groq.com https://openrouter.ai https://api.nal.usda.gov",
      "worker-src 'self'",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ].join('; ');

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
      { key: 'Content-Security-Policy', value: csp },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
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
