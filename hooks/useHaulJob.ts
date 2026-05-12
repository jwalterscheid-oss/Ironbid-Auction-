// hooks/useCountdown.ts — Live countdown timer
'use client'
import { useState, useEffect } from 'react'

interface CountdownResult {
  days:    number
  hours:   number
  minutes: number
  seconds: number
  total:   number   // ms remaining
  isUrgent: boolean // < 5 minutes
  isExpired: boolean
}

export function useCountdown(endTime: string | Date): CountdownResult {
  const getRemaining = () => {
    const end   = new Date(endTime).getTime()
    const now   = Date.now()
    const total = Math.max(0, end - now)
    return {
      days:      Math.floor(total / (1000 * 60 * 60 * 24)),
      hours:     Math.floor((total / (1000 * 60 * 60)) % 24),
      minutes:   Math.floor((total / 1000 / 60) % 60),
      seconds:   Math.floor((total / 1000) % 60),
      total,
      isUrgent:  total < 5 * 60 * 1000,
      isExpired: total <= 0,
    }
  }

  const [remaining, setRemaining] = useState(getRemaining)

  useEffect(() => {
    if (remaining.isExpired) return
    const id = setInterval(() => setRemaining(getRemaining()), 1000)
    return () => clearInterval(id)
  }, [endTime, remaining.isExpired])

  return remaining
}

export function formatCountdown(cd: CountdownResult): string {
  if (cd.isExpired) return 'Closed'
  if (cd.days > 0) return `${cd.days}d ${String(cd.hours).padStart(2, '0')}:${String(cd.minutes).padStart(2, '0')}`
  return `${String(cd.hours).padStart(2, '0')}:${String(cd.minutes).padStart(2, '0')}:${String(cd.seconds).padStart(2, '0')}`
}

// hooks/useHaulJob.ts — Real-time haul job state
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
