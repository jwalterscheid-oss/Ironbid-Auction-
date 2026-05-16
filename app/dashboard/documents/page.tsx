import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/dashboard/PlaceholderPage'

export const metadata: Metadata = { title: 'Documents | IRONBID' }
export const dynamic = 'force-dynamic'

export default function DocumentsPage() {
  return (
    <PlaceholderPage
      title="Account"
      accent="Documents"
      subtitle="KYC, title, and compliance files"
      description="Store and review uploaded IDs, title files, inspection documents, and compliance records tied to your account."
      actions={[
        { href: '/dashboard/verify', label: 'Open Verification' },
        { href: '/dashboard', label: 'Back to Dashboard', variant: 'ghost' },
      ]}
    />
  )
}
