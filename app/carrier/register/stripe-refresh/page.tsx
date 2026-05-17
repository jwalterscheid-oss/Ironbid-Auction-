// app/carrier/register/stripe-refresh/page.tsx — Stripe Connect onboarding link expired
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Payout Setup | IRONBID Carrier' }

export default function StripeRefreshPage() {
  return (
    <div className="onboarding-page">
      <div className="ob-card">
        <div className="ob-logo">IRON<span>BID</span></div>
        <h1 className="ob-title">Your setup link expired</h1>
        <p className="ob-sub">
          The link to set up your payout account is no longer valid. Stripe
          onboarding links expire after a short time for your security.
        </p>

        <div className="verify-section">
          <p>
            No problem — generate a fresh link and pick up right where you left
            off. Your registration details have been saved.
          </p>
          <a href="/api/carriers/stripe-onboard" className="ob-btn">Resume Payout Setup →</a>
        </div>
      </div>
    </div>
  )
}
