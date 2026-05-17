// components/carrier/LogTrackingButton.tsx — 'use client' tracking actions
'use client'
import { useState } from 'react'

interface Props { jobId: string; currentStatus: string }

// Delivery is confirmed by the buyer, not the carrier — the carrier's last
// loggable event is 'near_destination'.
const NEXT_ACTIONS: Record<string, { event: string; label: string }[]> = {
  awarded:    [{ event: 'bol_signed', label: '📋 Sign BOL' }, { event: 'picked_up', label: '🔧 Confirm Pickup' }],
  picked_up:  [{ event: 'gps_update', label: '📍 Log GPS Update' }, { event: 'near_destination', label: '📡 Near Destination' }],
  in_transit: [{ event: 'gps_update', label: '📍 Log GPS Update' }, { event: 'near_destination', label: '📡 Near Destination' }],
}

export function LogTrackingButton({ jobId, currentStatus }: Props) {
  const [loading, setLoading] = useState(false)
  const [notes, setNotes]     = useState('')
  const [address, setAddress] = useState('')
  const [showForm, setShow]   = useState(false)
  const [pendingEvent, setPending] = useState<string | null>(null)

  const actions = NEXT_ACTIONS[currentStatus] ?? []
  if (actions.length === 0) return null

  async function submit() {
    if (!pendingEvent) return
    setLoading(true)
    try {
      await fetch('/api/haul-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          haulJobId:     jobId,
          eventType:     pendingEvent,
          addressApprox: address || undefined,
          notes:         notes || undefined,
        }),
      })
      setShow(false)
      setNotes('')
      setAddress('')
      window.location.reload()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="tracking-actions">
      {!showForm ? (
        <div className="ta-buttons">
          {actions.map(action => (
            <button
              key={action.event}
              className="log-btn"
              onClick={() => { setPending(action.event); setShow(true) }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="ta-form">
          <div className="ta-form-title">Log: {actions.find(a => a.event === pendingEvent)?.label}</div>
          <input
            className="form-input"
            placeholder="Current location (e.g. Midland, TX)"
            value={address}
            onChange={e => setAddress(e.target.value)}
          />
          <input
            className="form-input"
            placeholder="Optional notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <div className="ta-form-actions">
            <button className="btn-ghost" onClick={() => setShow(false)}>Cancel</button>
            <button className="btn-teal" onClick={submit} disabled={loading}>
              {loading ? 'Saving...' : 'Log Update'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
