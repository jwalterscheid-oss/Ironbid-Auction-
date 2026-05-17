// hooks/useAuction.ts — Real-time auction state via Ably
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Ably from 'ably'
import type { Auction, Bid, PlaceBidResult } from '@/types'

interface AuctionState extends Partial<Auction> {
  isLoading:    boolean
  error:        string | null
  status:       'scheduled' | 'active' | 'extended' | 'closed' | 'cancelled'
  watcherCount: number
}

interface UseBidState {
  isSubmitting:  boolean
  lastError:     string | null
  lastResult:    PlaceBidResult | null
}

interface UseAuctionOptions {
  realtimeEnabled?: boolean
}

let ablyClient: Ably.Realtime | null = null

function getAblyClient(): Ably.Realtime {
  if (!ablyClient) {
    ablyClient = new Ably.Realtime({
      authUrl:    '/api/ably-token',
      authMethod: 'GET',
    })
  }
  return ablyClient
}

export function useAuction(
  auctionId: string,
  initialData?: Partial<Auction>,
  options: UseAuctionOptions = {}
) {
  const [state, setState] = useState<AuctionState>({
    ...initialData,
    isLoading:    !initialData,
    error:        null,
    status:       initialData?.status ?? 'active',
    watcherCount: initialData?.watchCount ?? 0,
  })

  const [bidHistory, setBidHistory] = useState<Bid[]>([])
  const [bidState, setBidState] = useState<UseBidState>({
    isSubmitting: false,
    lastError:    null,
    lastResult:   null,
  })

  const channelRef = useRef<Ably.RealtimeChannel | null>(null)
  const realtimeEnabled = options.realtimeEnabled ?? true

  // ── Fetch initial state ──
  useEffect(() => {
    if (initialData) return // skip if SSR data provided
    fetch(`/api/auctions/${auctionId}`)
      .then(r => r.json())
      .then(data => setState(s => ({ ...s, ...data, isLoading: false })))
      .catch(err => setState(s => ({ ...s, isLoading: false, error: err.message })))
  }, [auctionId, initialData])

  // ── Subscribe to real-time events ──
  useEffect(() => {
    if (!realtimeEnabled) return

    const client  = getAblyClient()
    const channel = client.channels.get(`auction:${auctionId}`)
    channelRef.current = channel

    channel.subscribe((msg) => {
      switch (msg.name) {
        case 'bid_placed':
          setState(s => ({
            ...s,
            currentBid: msg.data.amount,
            bidCount:   msg.data.bidCount,
            reserveMet: msg.data.reserveMet,
          }))
          setBidHistory(prev => [
            {
              id:           `live-${Date.now()}`,
              auctionId,
              bidderId:     msg.data.bidderMasked,
              amount:       msg.data.amount,
              bidType:      'manual',
              isWinning:    true,
              placedAt:     new Date(msg.data.at).toISOString(),
            },
            ...prev.slice(0, 49),
          ])
          break

        case 'auction_extended':
          setState(s => ({
            ...s,
            endTime: msg.data.newEndTime,
            status:  'extended',
          }))
          break

        case 'auction_closed':
          setState(s => ({
            ...s,
            status:     'closed',
            finalPrice: msg.data.finalPrice,
          }))
          break

        case 'auction_started':
          setState(s => ({ ...s, status: 'active' }))
          break

        case 'watcher_count':
          setState(s => ({ ...s, watcherCount: msg.data.count }))
          break
      }
    })

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [auctionId, realtimeEnabled])

  // ── Place bid ──
  const placeBid = useCallback(async (amount: number, maxBid?: number) => {
    setBidState(s => ({ ...s, isSubmitting: true, lastError: null }))

    try {
      const res = await fetch('/api/bids', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ auctionId, amount, maxBid }),
      })

      const data = await res.json()

      if (!res.ok) {
        setBidState(s => ({ ...s, isSubmitting: false, lastError: data.error ?? 'Bid failed' }))
        return { success: false, error: data.error }
      }

      setBidState(s => ({ ...s, isSubmitting: false, lastResult: data }))
      return { success: true, result: data as PlaceBidResult }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bid failed'
      setBidState(s => ({ ...s, isSubmitting: false, lastError: message }))
      return { success: false, error: message }
    }
  }, [auctionId])

  return { state, bidHistory, bidState, placeBid }
}
