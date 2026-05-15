/** @type {import('next').NextConfig} */
const allowedOrigins = ['localhost:3000', '127.0.0.1:3000']

const appUrl = process.env.NEXT_PUBLIC_APP_URL
if (appUrl) {
  try {
    allowedOrigins.push(new URL(appUrl).host)
  } catch {
    allowedOrigins.push(appUrl.replace(/^https?:\/\//, ''))
  }
}

if (process.env.VERCEL_URL) {
  allowedOrigins.push(process.env.VERCEL_URL)
}

const dedupedAllowedOrigins = [...new Set(allowedOrigins.filter(Boolean))]

const nextConfig = {
  experimental: { serverActions: { allowedOrigins: dedupedAllowedOrigins } },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
}

export default nextConfig