import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/dashboard/PlaceholderPage'

export const metadata: Metadata = { title: 'Payouts | IRONBID' }
export const dynamic = 'force-dynamic'

export default function PayoutsPage() {
  return (
    <PlaceholderPage
      title="Payout"
      accent="Center"
      subtitle="Disbursement tracking and transfer status"
      description="Track pending and completed seller disbursements, including settlement dates and transfer destinations."
      actions={[
        { href: '/dashboard/earnings', label: 'Open Earnings' },
        { href: '/dashboard', label: 'Back to Dashboard', variant: 'ghost' },
      ]}
    />
  )
}
