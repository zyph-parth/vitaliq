/** @type {import('next').NextConfig} */
const nextConfig = {
  serverActions: {
    // MEDIUM 5: read from env so server actions work after deploy
    allowedOrigins: process.env.NEXT_PUBLIC_APP_URL
      ? [process.env.NEXT_PUBLIC_APP_URL.replace('https://', '').replace('http://', '')]
      : ['localhost:3000'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.cloudinary.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      // CODE QUALITY: /nutrients renamed to /foods for clarity
      { source: '/nutrients', destination: '/foods', permanent: true },
      { source: '/nutrients/:path*', destination: '/foods/:path*', permanent: true },
    ]
  },
}

module.exports = nextConfig
