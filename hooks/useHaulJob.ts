'use client'
import { useState, useEffect, useCallback } from 'react'
import Ably from 'ably'
import type { HaulJob, HaulBid, HaulTracking } from '@/types'

export function useHaulJob(jobId: string, initialJob?: HaulJob) {
  const [job, setJob]           = useState<HaulJob | null>(initialJob ?? null)
  const [bids, setBids]         = useState<HaulBid[]>(initialJob?.haulBids ?? [])
  const [tracking, setTracking] = useState<HaulTracking[]>(initialJob?.tracking ?? [])
  const [isLoading, setLoading] = useState(!initialJob)

  // Fetch initial data
  useEffect(() => {
    if (initialJob) return
    fetch(`/api/haul-jobs/${jobId}`)
      .then(r => r.json())
      .then(data => {
        setJob(data)
        setBids(data.haulBids ?? [])
        setTracking(data.tracking ?? [])
        setLoading(false)
      })
  }, [jobId, initialJob])

  // Subscribe to real-time events
  useEffect(() => {
    const client  = new Ably.Realtime({ authUrl: '/api/ably-token' })
    const channel = client.channels.get(`haul:${jobId}`)

    channel.subscribe(msg => {
      switch (msg.name) {
        case 'haul_bid_received':
          setBids(prev =>
            [...prev, msg.data as HaulBid]
              .sort((a, b) => Number(a.amount) - Number(b.amount))
          )
          break
        case 'haul_gps_update':
        case 'haul_picked_up':
        case 'haul_near_destination':
        case 'haul_delivered':
          setTracking(prev => [msg.data as HaulTracking, ...prev])
          setJob(prev => prev ? { ...prev, status: msg.data.newStatus ?? prev.status } : prev)
          break
      }
    })

    return () => { channel.unsubscribe(); client.close() }
  }, [jobId])

  const awardBid = useCallback(async (bidId: string) => {
    const res = await fetch(`/api/haul-jobs/${jobId}/award`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bidId }),
    })
    if (!res.ok) throw new Error(await res.text())
    const updated = await res.json()
    setJob(updated)
  }, [jobId])

  const confirmDelivery = useCallback(async () => {
    const res = await fetch(`/api/haul-jobs/${jobId}/confirm-delivery`, { method: 'POST' })
    if (!res.ok) throw new Error(await res.text())
    setJob(prev => prev ? { ...prev, status: 'delivered' } : prev)
  }, [jobId])

  return { job, bids, tracking, isLoading, awardBid, confirmDelivery }
}
