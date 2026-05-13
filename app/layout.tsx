import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'

export const metadata: Metadata = {
  title: 'IRONBID',
  description: 'Heavy equipment auction marketplace',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
