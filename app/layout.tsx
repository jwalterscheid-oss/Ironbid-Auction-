import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'

export const metadata: Metadata = {
  title: 'IRONBID',
  description: 'Heavy equipment auction marketplace',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const content = (
    <html lang="en">
      <body>{children}</body>
    </html>
  )

  return <ClerkProvider>{content}</ClerkProvider>
}
