import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="auth-logo">IRON<span>BID</span></div>
        <p className="auth-tagline">Create your free account to start bidding</p>
        <ul className="auth-benefits">
          <li>✓ No listing fee for buyers</li>
          <li>✓ 14,000+ verified sellers</li>
          <li>✓ Secure ACH & wire payments</li>
          <li>✓ Post-auction haul marketplace</li>
        </ul>
      </div>
      <SignUp
        appearance={{
          elements: {
            rootBox: 'clerk-root',
            card: 'clerk-card',
            formButtonPrimary: 'clerk-btn-primary',
          },
          variables: {
            colorPrimary: '#c94a1a',
            colorBackground: '#1a1a16',
            colorText: '#f4f0e8',
            colorInputText: '#f4f0e8',
            colorInputBackground: '#0a0a08',
            borderRadius: '0px',
          },
        }}
      />
    </div>
  )
}