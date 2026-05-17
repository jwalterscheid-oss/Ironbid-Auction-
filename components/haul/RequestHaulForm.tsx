// components/haul/RequestHaulForm.tsx — 'use client' "Request a Haul" creation form
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface EligibleTransaction {
  id: string
  label: string
}

interface Props { transactions: EligibleTransaction[] }

const TRAILER_TYPES = [
  { value: 'any',        label: 'Any' },
  { value: 'rgn',        label: 'RGN' },
  { value: 'lowboy',     label: 'Lowboy' },
  { value: 'step_deck',  label: 'Step Deck' },
  { value: 'flatbed',    label: 'Flatbed' },
  { value: 'extendable', label: 'Extendable' },
]

const BID_WINDOWS = [
  { value: '6',  label: '6 hours' },
  { value: '24', label: '24 hours' },
  { value: '48', label: '48 hours' },
  { value: '72', label: '72 hours' },
]

const REQUIREMENT_OPTIONS = [
  'Permits required',
  'Pilot car required',
  'Oversize load',
  'Crane needed at pickup',
  'Crane needed at delivery',
  'Tarping required',
]

export function RequestHaulForm({ transactions }: Props) {
  const router = useRouter()

  const [transactionId, setTransactionId]   = useState(transactions[0]?.id ?? '')
  const [pickupAddress, setPickupAddress]   = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [trailerType, setTrailerType]       = useState('any')
  const [requirements, setRequirements]     = useState<string[]>([])
  const [notes, setNotes]                   = useState('')
  const [pickupDate, setPickupDate]         = useState('')
  const [deadline, setDeadline]             = useState('')
  const [maxBudget, setMaxBudget]           = useState('')
  const [bidWindow, setBidWindow]           = useState('24')

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  function toggleRequirement(value: string) {
    setRequirements(prev =>
      prev.includes(value) ? prev.filter(r => r !== value) : [...prev, value]
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!transactionId)            return setError('Select a purchase to ship.')
    if (pickupAddress.trim().length < 5)   return setError('Enter a valid pickup address.')
    if (deliveryAddress.trim().length < 5) return setError('Enter a valid delivery address.')

    setLoading(true)
    try {
      const res = await fetch('/api/haul-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id:       transactionId,
          pickup_address:       pickupAddress.trim(),
          delivery_address:     deliveryAddress.trim(),
          trailer_type:         trailerType,
          special_requirements: requirements,
          notes:                notes.trim() || undefined,
          desired_pickup_date:  pickupDate || undefined,
          delivery_deadline:    deadline || undefined,
          max_budget:           maxBudget ? Number(maxBudget) : undefined,
          bid_window_hrs:       bidWindow,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(typeof data?.error === 'string' ? data.error : 'Failed to create haul job')
        return
      }
      const job = await res.json()
      router.push(`/dashboard/haul/${job.id}`)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="nl-card" onSubmit={submit}>
      <div className="form-section">
        <div className="form-field">
          <label>Purchase to Ship</label>
          <select value={transactionId} onChange={e => setTransactionId(e.target.value)}>
            {transactions.map(tx => (
              <option key={tx.id} value={tx.id}>{tx.label}</option>
            ))}
          </select>
        </div>

        <div className="form-grid-2">
          <div className="form-field">
            <label>Pickup Address</label>
            <input
              value={pickupAddress}
              onChange={e => setPickupAddress(e.target.value)}
              placeholder="Yard or seller address"
            />
          </div>
          <div className="form-field">
            <label>Delivery Address</label>
            <input
              value={deliveryAddress}
              onChange={e => setDeliveryAddress(e.target.value)}
              placeholder="Where the equipment goes"
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-field">
            <label>Trailer Type</label>
            <select value={trailerType} onChange={e => setTrailerType(e.target.value)}>
              {TRAILER_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Bid Window</label>
            <select value={bidWindow} onChange={e => setBidWindow(e.target.value)}>
              {BID_WINDOWS.map(w => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-field">
            <label>Desired Pickup Date <span className="opt">(optional)</span></label>
            <input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} />
          </div>
          <div className="form-field">
            <label>Delivery Deadline <span className="opt">(optional)</span></label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
        </div>

        <div className="form-field">
          <label>Max Budget <span className="opt">(optional)</span></label>
          <input
            type="number"
            min="0"
            step="1"
            value={maxBudget}
            onChange={e => setMaxBudget(e.target.value)}
            placeholder="e.g. 2500"
          />
        </div>

        <div className="form-field">
          <label>Special Requirements</label>
          <div className="insp-options" style={{ flexWrap: 'wrap', gap: '6px' }}>
            {REQUIREMENT_OPTIONS.map(opt => (
              <button
                type="button"
                key={opt}
                className={`insp-btn${requirements.includes(opt) ? ' selected insp-pass' : ''}`}
                style={{ minWidth: 'auto' }}
                onClick={() => toggleRequirement(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="form-field">
          <label>Notes <span className="opt">(optional)</span></label>
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Anything carriers should know about access, equipment, or timing"
          />
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="nl-nav">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Posting...' : 'Post Haul Job'}
          </button>
        </div>
      </div>
    </form>
  )
}
