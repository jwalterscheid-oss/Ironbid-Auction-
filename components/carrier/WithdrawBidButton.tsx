// components/carrier/WithdrawBidButton.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function WithdrawBidButton({ bidId }: { bidId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function withdraw() {
    if (!confirm('Withdraw this bid? This cannot be undone.')) return
    setLoading(true)
    await fetch(`/api/haul-bids/${bidId}/withdraw`, { method: 'PATCH' })
    router.refresh()
    setLoading(false)
  }

  return (
    <button className="withdraw-btn" onClick={withdraw} disabled={loading}>
      {loading ? '...' : 'Withdraw'}
    </button>
  )
}
