// app/dashboard/listings/new/page.tsx — Create listing (Client Component wizard)
'use client'
import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

import type { Category, ConditionGrade } from '@/types'

type Step = 'details' | 'condition' | 'media' | 'auction' | 'review'
type AuctionTypeOption = { value: FormState['auctionType']; label: string; desc: string }

interface FormState {
  // Step 1 — Details
  category:     Category | ''
  make:         string
  model:        string
  year:         number | ''
  serialNumber: string
  hours:        number | ''
  weightKg:     number | ''
  locationCity: string
  locationState: string
  description:  string

  // Step 2 — Condition
  conditionGrade: ConditionGrade | ''
  inspectionData: Record<string, 'pass' | 'fair' | 'fail'>

  // Step 3 — Media (handled via upload)
  photos: File[]

  // Step 4 — Auction settings
  auctionType:     'timed' | 'live' | 'buy_now'
  startingBid:     number | ''
  reservePrice:    number | ''
  buyNowPrice:     number | ''
  auctionDuration: '1day' | '3day' | '7day' | '14day'
}

const INITIAL: FormState = {
  category: '', make: '', model: '', year: '', serialNumber: '',
  hours: '', weightKg: '', locationCity: '', locationState: '', description: '',
  conditionGrade: '', inspectionData: {},
  photos: [],
  auctionType: 'timed', startingBid: '', reservePrice: '', buyNowPrice: '',
  auctionDuration: '7day',
}

const STEPS: { id: Step; label: string }[] = [
  { id: 'details',  label: 'Equipment Details' },
  { id: 'condition',label: 'Condition & Inspection' },
  { id: 'media',    label: 'Photos & Documents' },
  { id: 'auction',  label: 'Auction Settings' },
  { id: 'review',   label: 'Review & Publish' },
]

export default function NewListingPage() {
  const router         = useRouter()
  useUser()
  const [step, setStep] = useState<Step>('details')
  const [form, setForm] = useState<FormState>(INITIAL)
  const [loading, setLoad] = useState(false)
  const [error, setError]  = useState<string | null>(null)

  const stepIdx     = STEPS.findIndex(s => s.id === step)
  const isLastStep  = stepIdx === STEPS.length - 1
  const progress    = ((stepIdx + 1) / STEPS.length) * 100

  function update<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function nextStep() {
    const next = STEPS[stepIdx + 1]
    if (next) setStep(next.id)
  }

  function prevStep() {
    const prev = STEPS[stepIdx - 1]
    if (prev) setStep(prev.id)
  }

  async function handleSubmit() {
    setLoad(true)
    setError(null)
    try {
      // 1. Create listing
      const listingRes = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category:      form.category,
          make:          form.make,
          model:         form.model,
          year:          Number(form.year),
          serialNumber:  form.serialNumber || undefined,
          hours:         form.hours ? Number(form.hours) : undefined,
          weightKg:      form.weightKg ? Number(form.weightKg) : undefined,
          conditionGrade: form.conditionGrade || undefined,
          description:   form.description,
          locationCity:  form.locationCity,
          locationState: form.locationState,
          inspectionData: form.inspectionData,
        }),
      })
      if (!listingRes.ok) throw new Error(await listingRes.text())
      const listing = await listingRes.json()

      // 2. Upload photos (if any)
      if (form.photos.length > 0) {
        const fd = new FormData()
        form.photos.forEach(f => fd.append('photos', f))
        fd.append('listingId', listing.id)
        await fetch('/api/listings/upload-photos', { method: 'POST', body: fd })
      }

      // 3. Create auction
      const now = new Date()
      const durationMs = { '1day': 86400000, '3day': 259200000, '7day': 604800000, '14day': 1209600000 }[form.auctionDuration]
      const endTime = new Date(now.getTime() + durationMs).toISOString()

      const auctionRes = await fetch('/api/auctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId:    listing.id,
          type:         form.auctionType,
          startTime:    now.toISOString(),
          endTime,
          startingBid:  Number(form.startingBid),
          reservePrice: form.reservePrice ? Number(form.reservePrice) : undefined,
          buyNowPrice:  form.buyNowPrice  ? Number(form.buyNowPrice)  : undefined,
          minIncrement: deriveIncrement(Number(form.startingBid)),
        }),
      })
      if (!auctionRes.ok) throw new Error(await auctionRes.text())
      const auction = await auctionRes.json()

      router.push(`/auctions/${auction.id}?created=1`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to publish auction')
    }
    setLoad(false)
  }

  function deriveIncrement(startingBid: number) {
    if (startingBid >= 500000) return 5000
    if (startingBid >= 200000) return 2500
    if (startingBid >= 50000)  return 1000
    return 500
  }

  return (
    <div className="new-listing-page">
      <div className="nl-header">
        <h1 className="page-title">New <span>Listing</span></h1>
        <p className="page-sub">Complete all steps to publish your auction</p>
      </div>

      {/* Step progress bar */}
      <div className="step-progress">
        <div className="sp-bar"><div className="sp-fill" style={{ width: `${progress}%` }} /></div>
        <div className="sp-steps">
          {STEPS.map((s, i) => (
            <div key={s.id} className={`sp-step ${stepIdx >= i ? 'done' : ''} ${s.id === step ? 'active' : ''}`}>
              <div className="sp-dot">{stepIdx > i ? '✓' : i + 1}</div>
              <div className="sp-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="nl-card">
        {/* ── STEP 1: DETAILS ── */}
        {step === 'details' && (
          <div className="form-section">
            <h2 className="form-section-title">Equipment Details</h2>
            <div className="form-grid-2">
              <div className="form-field">
                <label>Category *</label>
                <select value={form.category} onChange={e => update('category', e.target.value as Category)} required>
                  <option value="">Select category</option>
                  <option value="excavator">Excavator</option>
                  <option value="bulldozer">Bulldozer</option>
                  <option value="crane">Crane</option>
                  <option value="loader">Loader</option>
                  <option value="truck">Haul Truck</option>
                  <option value="aerial">Aerial Work Platform</option>
                  <option value="compactor">Compactor</option>
                  <option value="skid_steer">Skid Steer</option>
                </select>
              </div>
              <div className="form-field">
                <label>Year *</label>
                <input type="number" min={1990} max={2025} value={form.year} onChange={e => update('year', Number(e.target.value))} placeholder="e.g. 2019" required />
              </div>
              <div className="form-field">
                <label>Make *</label>
                <input type="text" value={form.make} onChange={e => update('make', e.target.value)} placeholder="e.g. Caterpillar" required />
              </div>
              <div className="form-field">
                <label>Model *</label>
                <input type="text" value={form.model} onChange={e => update('model', e.target.value)} placeholder="e.g. 320" required />
              </div>
              <div className="form-field">
                <label>Serial Number</label>
                <input type="text" value={form.serialNumber} onChange={e => update('serialNumber', e.target.value)} placeholder="VIN or serial number" />
              </div>
              <div className="form-field">
                <label>Operating Hours</label>
                <input type="number" min={0} value={form.hours} onChange={e => update('hours', Number(e.target.value))} placeholder="e.g. 4820" />
              </div>
              <div className="form-field">
                <label>Weight (kg)</label>
                <input type="number" min={0} value={form.weightKg} onChange={e => update('weightKg', Number(e.target.value))} placeholder="e.g. 20300" />
              </div>
              <div className="form-field">
                <label>City</label>
                <input type="text" value={form.locationCity} onChange={e => update('locationCity', e.target.value)} placeholder="e.g. Dallas" />
              </div>
              <div className="form-field">
                <label>State</label>
                <input type="text" maxLength={2} value={form.locationState} onChange={e => update('locationState', e.target.value.toUpperCase())} placeholder="TX" />
              </div>
            </div>
            <div className="form-field full">
              <label>Description</label>
              <textarea rows={5} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Describe the equipment's condition, recent service, included attachments, and any known issues..." />
            </div>
          </div>
        )}

        {/* ── STEP 2: CONDITION ── */}
        {step === 'condition' && (
          <div className="form-section">
            <h2 className="form-section-title">Condition & Inspection</h2>
            <div className="form-field" style={{ marginBottom: 24 }}>
              <label>Overall Condition Grade *</label>
              <div className="grade-selector">
                {(['A+', 'A', 'B', 'C', 'D'] as ConditionGrade[]).map(g => (
                  <button
                    key={g}
                    type="button"
                    className={`grade-btn grade-${g.replace('+','-plus')} ${form.conditionGrade === g ? 'selected' : ''}`}
                    onClick={() => update('conditionGrade', g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <h3>Component Inspection</h3>
            <p className="form-hint">Rate each component — buyers see this before bidding</p>
            <div className="inspection-grid">
              {INSPECTION_COMPONENTS.map(comp => (
                <div key={comp.key} className="insp-row">
                  <span className="insp-name">{comp.label}</span>
                  <div className="insp-options">
                    {(['pass', 'fair', 'fail'] as const).map(val => (
                      <button
                        key={val}
                        type="button"
                        className={`insp-btn insp-${val} ${form.inspectionData[comp.key] === val ? 'selected' : ''}`}
                        onClick={() => update('inspectionData', { ...form.inspectionData, [comp.key]: val })}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 3: MEDIA ── */}
        {step === 'media' && (
          <div className="form-section">
            <h2 className="form-section-title">Photos & Documents</h2>
            <div className="upload-zone" onDrop={e => {
              e.preventDefault()
              const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
              update('photos', [...form.photos, ...files])
            }} onDragOver={e => e.preventDefault()}>
              <div className="uz-icon">📷</div>
              <div className="uz-title">Drag photos here or click to browse</div>
              <div className="uz-sub">Minimum 4 photos required. JPEG or PNG, max 10MB each.</div>
              <input type="file" multiple accept="image/*" className="uz-input" onChange={e => {
                const files = Array.from(e.target.files ?? [])
                update('photos', [...form.photos, ...files])
              }} />
            </div>
            {form.photos.length > 0 && (
              <div className="photo-preview-grid">
                {form.photos.map((f, i) => (
                  <div key={i} className="photo-thumb">
                    <Image src={URL.createObjectURL(f)} alt={`Photo ${i + 1}`} width={320} height={240} unoptimized />
                    <button className="remove-photo" onClick={() => update('photos', form.photos.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="form-hint">
              Tip: Include photos of the engine bay, undercarriage, cab interior, bucket/blade, and any damage or wear.
            </div>
          </div>
        )}

        {/* ── STEP 4: AUCTION SETTINGS ── */}
        {step === 'auction' && (
          <div className="form-section">
            <h2 className="form-section-title">Auction Settings</h2>

            <div className="form-field" style={{ marginBottom: 24 }}>
              <label>Auction Type</label>
              <div className="type-selector">
                {([
                  { value: 'timed',   label: 'Timed Auction',  desc: 'Set a close time — highest bid wins' },
                  { value: 'buy_now', label: 'Buy Now',         desc: 'Fixed price — first buyer wins immediately' },
                ] satisfies AuctionTypeOption[]).map(t => (
                  <div
                    key={t.value}
                    className={`type-card ${form.auctionType === t.value ? 'selected' : ''}`}
                    onClick={() => update('auctionType', t.value)}
                  >
                    <div className="tc-label">{t.label}</div>
                    <div className="tc-desc">{t.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-field">
                <label>Starting Bid ($) *</label>
                <input type="number" min={500} value={form.startingBid} onChange={e => update('startingBid', Number(e.target.value))} placeholder="e.g. 50000" required />
              </div>
              <div className="form-field">
                <label>Reserve Price ($) <span className="opt">(optional)</span></label>
                <input type="number" min={0} value={form.reservePrice} onChange={e => update('reservePrice', Number(e.target.value))} placeholder="Hidden minimum you'll accept" />
              </div>
              {form.auctionType === 'buy_now' && (
                <div className="form-field">
                  <label>Buy Now Price ($) *</label>
                  <input type="number" min={0} value={form.buyNowPrice} onChange={e => update('buyNowPrice', Number(e.target.value))} required />
                </div>
              )}
              {form.auctionType === 'timed' && (
                <div className="form-field">
                  <label>Auction Duration</label>
                  <select value={form.auctionDuration} onChange={e => update('auctionDuration', e.target.value as FormState['auctionDuration'])}>
                    <option value="1day">1 Day</option>
                    <option value="3day">3 Days</option>
                    <option value="7day">7 Days (recommended)</option>
                    <option value="14day">14 Days</option>
                  </select>
                </div>
              )}
            </div>

            <div className="fee-summary">
              <div className="fs-title">Fee Summary</div>
              <div className="fs-row"><span>Seller Fee</span><strong>2% of final sale price</strong></div>
              <div className="fs-row"><span>Buyer&apos;s Premium (paid by buyer)</span><strong>12%</strong></div>
              <div className="fs-row"><span>Listing Fee</span><strong>$0</strong></div>
            </div>
          </div>
        )}

        {/* ── STEP 5: REVIEW ── */}
        {step === 'review' && (
          <div className="form-section">
            <h2 className="form-section-title">Review & Publish</h2>
            <div className="review-grid">
              <div className="review-section">
                <div className="rs-label">Equipment</div>
                <div className="rs-value">{form.year} {form.make} {form.model}</div>
                <div className="rs-meta">{form.category} · {form.hours?.toLocaleString()} hrs · Grade {form.conditionGrade}</div>
              </div>
              <div className="review-section">
                <div className="rs-label">Location</div>
                <div className="rs-value">{form.locationCity}, {form.locationState}</div>
              </div>
              <div className="review-section">
                <div className="rs-label">Auction</div>
                <div className="rs-value">{form.auctionType === 'timed' ? `${form.auctionDuration} timed auction` : 'Buy Now'}</div>
                <div className="rs-meta">Starting bid: ${Number(form.startingBid).toLocaleString()}</div>
              </div>
              <div className="review-section">
                <div className="rs-label">Photos</div>
                <div className="rs-value">{form.photos.length} photo{form.photos.length !== 1 ? 's' : ''} uploaded</div>
              </div>
            </div>

            {error && <div className="form-error">⚠ {error}</div>}

            <div className="review-agreement">
              By publishing this listing you agree to IRONBID&apos;s{' '}
              <a href="/terms">Seller Terms</a> and confirm this equipment
              is free of liens and available for sale.
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="nl-nav">
        {stepIdx > 0 && (
          <button className="btn-ghost" onClick={prevStep} disabled={loading}>← Back</button>
        )}
        {!isLastStep ? (
          <button className="btn-primary" onClick={nextStep}>Continue →</button>
        ) : (
          <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Publishing...' : 'Publish Auction →'}
          </button>
        )}
      </div>
    </div>
  )
}

const INSPECTION_COMPONENTS = [
  { key: 'engine',      label: 'Engine' },
  { key: 'hydraulics',  label: 'Hydraulics' },
  { key: 'tracks',      label: 'Tracks & Undercarriage' },
  { key: 'cab',         label: 'Cab & Controls' },
  { key: 'boom',        label: 'Boom & Stick' },
  { key: 'bucket',      label: 'Bucket & Teeth' },
  { key: 'electrical',  label: 'Electrical' },
  { key: 'cooling',     label: 'Cooling System' },
]
