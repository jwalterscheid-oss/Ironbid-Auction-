import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/dashboard/PlaceholderPage'

export const metadata: Metadata = { title: 'Watchlist | IRONBID' }
export const dynamic = 'force-dynamic'

export default function WatchlistPage() {
  return (
    <PlaceholderPage
      title="My"
      accent="Watchlist"
      subtitle="Saved lots and tracked bidding activity"
      description="Save auctions to monitor pricing momentum, outbid alerts, and closing windows in one view."
      actions={[
        { href: '/auctions', label: 'Browse Auctions' },
        { href: '/dashboard', label: 'Back to Dashboard', variant: 'ghost' },
      ]}
    />
  )
}
