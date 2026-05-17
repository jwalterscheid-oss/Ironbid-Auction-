// components/haul/ConfirmDeliveryButton.tsx — 'use client' confirm delivery + release payment
'use client'
import { useState } from 'react'

interface Props { jobId: string }

export function ConfirmDeliveryButton({ jobId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function confirm() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/haul-jobs/${jobId}/confirm-delivery`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(typeof data?.error === 'string' ? data.error : 'Failed to confirm delivery')
        return
      }
      window.location.reload()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="tracking-actions">
      <button className="btn-primary" onClick={confirm} disabled={loading}>
        {loading ? 'Releasing Payment...' : 'Confirm Delivery & Release Payment'}
      </button>
      {error && <div className="bid-error" style={{ marginTop: '8px' }}>{error}</div>}
    </div>
  )
}
