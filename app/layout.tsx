import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Bebas_Neue, DM_Sans, DM_Mono } from 'next/font/google'
import '../styles/globals.css'

const displayFont = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
})

const bodyFont = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-body',
})

const monoFont = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'IRONBID',
  description: 'Heavy equipment auction marketplace',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const content = (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
        {children}
      </body>
    </html>
  )

  return <ClerkProvider>{content}</ClerkProvider>
}
