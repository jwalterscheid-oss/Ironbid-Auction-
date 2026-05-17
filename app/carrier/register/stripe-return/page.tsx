// app/carrier/register/stripe-return/page.tsx — Post Stripe Connect onboarding return
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Payout Setup | IRONBID Carrier' }

export default function StripeReturnPage() {
  return (
    <div className="onboarding-page">
      <div className="ob-card">
        <div className="ob-logo">IRON<span>BID</span></div>
        <h1 className="ob-title">Payout account submitted</h1>
        <p className="ob-sub">
          Thanks for connecting your payout account. Stripe is verifying your
          details now — this usually takes just a few minutes, but can take up
          to a couple of business days.
        </p>

        <div className="verify-section">
          <p>
            You can start bidding on haul jobs right away. Payouts will be
            released automatically once verification completes.
          </p>
          <Link href="/carrier" className="ob-btn">Go to Carrier Dashboard →</Link>
        </div>
      </div>
    </div>
  )
}
