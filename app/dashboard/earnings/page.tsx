import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/dashboard/PlaceholderPage'

export const metadata: Metadata = { title: 'Earnings | IRONBID' }
export const dynamic = 'force-dynamic'

export default function EarningsPage() {
  return (
    <PlaceholderPage
      title="Seller"
      accent="Earnings"
      subtitle="Revenue, fees, and payout visibility"
      description="Review gross sales, platform fees, and net proceeds by auction and settlement window."
      actions={[
        { href: '/dashboard/payouts', label: 'View Payouts' },
        { href: '/dashboard', label: 'Back to Dashboard', variant: 'ghost' },
      ]}
    />
  )
}
