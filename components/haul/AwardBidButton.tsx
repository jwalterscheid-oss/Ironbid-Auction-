// components/haul/AwardBidButton.tsx — 'use client' award action for a haul bid
'use client'
import { useState } from 'react'

interface Props { jobId: string; bidId: string }

export function AwardBidButton({ jobId, bidId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function award() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/haul-jobs/${jobId}/award`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(typeof data?.error === 'string' ? data.error : 'Failed to award bid')
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
    <div>
      <button className="btn-teal btn-sm" onClick={award} disabled={loading}>
        {loading ? 'Awarding...' : 'Award'}
      </button>
      {error && <div className="bid-error" style={{ marginTop: '6px' }}>{error}</div>}
    </div>
  )
}
