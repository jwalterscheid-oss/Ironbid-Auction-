import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/dashboard/PlaceholderPage'

export const metadata: Metadata = { title: 'Messages | IRONBID' }
export const dynamic = 'force-dynamic'

export default function MessagesPage() {
  return (
    <PlaceholderPage
      title="Team"
      accent="Messages"
      subtitle="Buyer, carrier, and support conversations"
      description="Communicate with buyers, dispatch teams, and support agents around lot details, pickup timing, and delivery milestones."
      actions={[
        { href: '/dashboard/haul', label: 'View Haul Jobs' },
        { href: '/dashboard', label: 'Back to Dashboard', variant: 'ghost' },
      ]}
    />
  )
}
