import type { Metadata } from 'next'
import { PlaceholderPage } from '@/components/dashboard/PlaceholderPage'

export const metadata: Metadata = { title: 'Settings | IRONBID' }
export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Account"
      accent="Settings"
      subtitle="Profile, notification, and payout preferences"
      description="Control profile information, alert channels, and business defaults used across listing, bidding, and settlement workflows."
      actions={[
        { href: '/dashboard/verify', label: 'Open Verification' },
        { href: '/dashboard', label: 'Back to Dashboard', variant: 'ghost' },
      ]}
    />
  )
}
