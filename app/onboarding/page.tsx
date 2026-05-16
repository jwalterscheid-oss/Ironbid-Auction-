// app/onboarding/page.tsx — New user onboarding
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

type Step = 'role' | 'verify' | 'done'

export default function OnboardingPage() {
  const { user } = useUser()
  const router   = useRouter()
  const [step, setStep]     = useState<Step>('role')
  const [role, setRole]     = useState<'buyer' | 'seller' | 'carrier'>('buyer')
  const [loading, setLoad]  = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const displayName = user?.firstName || user?.username || 'there'

  async function submitRole() {
    setError(null)
    setLoad(true)
    try {
      const res = await fetch('/api/onboarding/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Unable to save your role. Please try again.')
      }

      if (role === 'carrier') {
        router.push('/carrier/register')
      } else if (role === 'seller') {
        setStep('verify')
      } else {
        setStep('done')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to continue. Please try again.'
      setError(message)
    } finally {
      setLoad(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="onboarding-done">
        <h1>Welcome to IRONBID, {displayName}!</h1>
        <p>Your account is set up. Start browsing live auctions.</p>
        <button onClick={() => router.push('/auctions')}>Browse Auctions →</button>
      </div>
    )
  }

  return (
    <div className="onboarding-page">
      <div className="ob-card">
        <div className="ob-logo">IRON<span>BID</span></div>
        <h1 className="ob-title">Welcome, {displayName}!</h1>
        <p className="ob-sub">Tell us how you plan to use IRONBID</p>

        {step === 'role' && (
          <>
            <div className="role-grid">
              {([
                { value: 'buyer',   icon: '🏆', title: 'Buyer',   desc: 'Bid on and purchase heavy equipment at auction' },
                { value: 'seller',  icon: '🏷️', title: 'Seller',  desc: 'List your equipment for auction and find qualified buyers' },
                { value: 'carrier', icon: '🚛', title: 'Carrier', desc: 'Bid on haul jobs to transport purchased equipment' },
              ] as const).map(r => (
                <button
                  key={r.value}
                  className={`role-card ${role === r.value ? 'selected' : ''}`}
                  onClick={() => setRole(r.value)}
                >
                  <span className="rc-icon">{r.icon}</span>
                  <span className="rc-title">{r.title}</span>
                  <span className="rc-desc">{r.desc}</span>
                </button>
              ))}
            </div>
            <button className="ob-btn" onClick={submitRole} disabled={loading}>
              {loading ? 'Setting up...' : `Continue as ${role} →`}
            </button>
            {error && <p className="ob-error">{error}</p>}
          </>
        )}

        {step === 'verify' && (
          <div className="verify-section">
            <p>Seller accounts require identity verification. Upload a government-issued ID to get started.</p>
            <button className="ob-btn" onClick={() => router.push('/dashboard')}>
              Complete Verification in Dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
