// components/dashboard/PayNowButton.tsx — Buyer invoice payment trigger (Client Component)
'use client'
import { useState } from 'react'

interface Props {
  transactionId: string
}

export function PayNowButton({ transactionId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePay() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/transactions/${transactionId}/pay`, {
        method: 'POST',
      })
      if (!res.ok) {
        let message = `Payment failed (${res.status})`
        try {
          const data = await res.json()
          if (typeof data?.error === 'string' && data.error) message = data.error
        } catch {
          // ignore parse errors and fall back to default message
        }
        throw new Error(message)
      }
      const data = await res.json()
      if (typeof data?.url !== 'string' || !data.url) {
        throw new Error('Payment session could not be created.')
      }
      window.location.href = data.url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment failed')
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '4px' }}>
      <button className="btn-primary btn-sm" onClick={handlePay} disabled={loading}>
        {loading ? 'Processing…' : 'Pay Now'}
      </button>
      {error && <span className="bid-error">{error}</span>}
    </div>
  )
}
