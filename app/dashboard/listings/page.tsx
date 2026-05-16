import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/dashboard/PlaceholderPage'

export const metadata: Metadata = { title: 'My Listings | IRONBID' }
export const dynamic = 'force-dynamic'

export default function ListingsPage() {
  return (
    <PlaceholderPage
      title="My"
      accent="Listings"
      subtitle="Manage your active and draft lots"
      description="Track listing performance, update lot details, and launch new auctions from one place."
      actions={[
        { href: '/dashboard/listings/new', label: '+ NEW LISTING' },
        { href: '/dashboard', label: 'Back to Dashboard', variant: 'ghost' },
      ]}
    />
  )
}
