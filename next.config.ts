// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: { serverActions: { allowedOrigins: ['localhost:3000'] } },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
}

export default nextConfig
