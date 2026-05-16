import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/dashboard/PlaceholderPage'

export const metadata: Metadata = { title: 'Invoices | IRONBID' }
export const dynamic = 'force-dynamic'

export default function InvoicesPage() {
  return (
    <PlaceholderPage
      title="Billing"
      accent="Invoices"
      subtitle="Downloadable transaction records"
      description="Access invoice history for auction sales, buyer premiums, and service charges for accounting and reconciliation."
      actions={[
        { href: '/dashboard/earnings', label: 'Open Earnings' },
        { href: '/dashboard', label: 'Back to Dashboard', variant: 'ghost' },
      ]}
    />
  )
}
