// app/layout.tsx — Root layout
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { QueryProvider } from '@/components/providers/QueryProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'IRONBID — Heavy Equipment Auctions',
  description: 'The industrial marketplace for excavators, cranes, bulldozers, and heavy machinery.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <QueryProvider>
            {children}
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
