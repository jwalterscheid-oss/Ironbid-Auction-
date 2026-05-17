// components/carrier/CarrierRegisterForm.tsx — Carrier registration (Client Component form)
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type TrailerType = 'rgn' | 'lowboy' | 'step_deck' | 'flatbed' | 'extendable'

interface FormState {
  companyName:      string
  mcNumber:         string
  dotNumber:        string
  trailerTypes:     TrailerType[]
  maxLoadTons:      number | ''
  baseState:        string
  serviceStates:    string[]
  insuranceAmount:  number | ''
  insuranceExpires: string
  bio:              string
}

const INITIAL: FormState = {
  companyName: '', mcNumber: '', dotNumber: '',
  trailerTypes: [], maxLoadTons: '',
  baseState: '', serviceStates: [],
  insuranceAmount: '', insuranceExpires: '', bio: '',
}

const TRAILER_OPTIONS: { value: TrailerType; label: string; desc: string }[] = [
  { value: 'rgn',        label: 'RGN',        desc: 'Removable gooseneck — drive-on for tall, heavy equipment' },
  { value: 'lowboy',     label: 'Lowboy',     desc: 'Low deck height for oversized loads' },
  { value: 'step_deck',  label: 'Step Deck',  desc: 'Two-level deck for taller freight' },
  { value: 'flatbed',    label: 'Flatbed',    desc: 'Standard open deck for general equipment' },
  { value: 'extendable', label: 'Extendable', desc: 'Adjustable length for long loads' },
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV',
  'WI','WY',
]

export function CarrierRegisterForm() {
  const router             = useRouter()
  const [form, setForm]    = useState<FormState>(INITIAL)
  const [loading, setLoad] = useState(false)
  const [error, setError]  = useState<string | null>(null)

  function update<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function clean(value: string) {
    return value.trim()
  }

  function parseOptionalNumber(value: string): number | '' {
    return value === '' ? '' : Number(value)
  }

  function toggleTrailer(value: TrailerType) {
    setForm(f => ({
      ...f,
      trailerTypes: f.trailerTypes.includes(value)
        ? f.trailerTypes.filter(t => t !== value)
        : [...f.trailerTypes, value],
    }))
  }

  function toggleServiceState(value: string) {
    setForm(f => ({
      ...f,
      serviceStates: f.serviceStates.includes(value)
        ? f.serviceStates.filter(s => s !== value)
        : [...f.serviceStates, value],
    }))
  }

  function validate(): string | null {
    if (clean(form.companyName).length < 2) return 'Enter your company name (at least 2 characters).'
    if (!/^\d{6,8}$/.test(form.mcNumber)) return 'Enter a valid MC number (6 to 8 digits).'
    if (form.dotNumber && !/^\d{7}$/.test(form.dotNumber)) return 'DOT number must be exactly 7 digits, or left blank.'
    if (form.trailerTypes.length === 0) return 'Select at least one trailer type.'
    if (form.maxLoadTons === '' || Number(form.maxLoadTons) < 1 || Number(form.maxLoadTons) > 200) {
      return 'Enter a maximum load capacity between 1 and 200 tons.'
    }
    if (!/^[A-Z]{2}$/.test(form.baseState)) return 'Select your base state.'
    if (form.serviceStates.length === 0) return 'Select at least one service area state.'
    if (form.insuranceAmount === '' || Number(form.insuranceAmount) < 1_000_000) {
      return 'Cargo insurance coverage must be at least $1,000,000.'
    }
    if (!form.insuranceExpires) return 'Enter your insurance expiration date.'
    return null
  }

  async function readErrorBody(res: Response) {
    try {
      const data = await res.json()
      if (typeof data?.error === 'string' && data.error) return data.error
    } catch {
      // ignore JSON parse errors and fall back to plain text
    }
    try {
      const text = await res.text()
      if (text) return text
    } catch {
      // ignore text read errors
    }
    return `Request failed (${res.status})`
  }

  async function handleSubmit() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoad(true)
    setError(null)

    try {
      let res: Response
      try {
        res = await fetch('/api/carriers/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_name:      clean(form.companyName),
            mc_number:         form.mcNumber,
            dot_number:        form.dotNumber || undefined,
            trailer_types:     form.trailerTypes,
            max_load_tons:     Number(form.maxLoadTons),
            base_state:        form.baseState,
            service_states:    form.serviceStates,
            insurance_amount:  Number(form.insuranceAmount),
            insurance_expires: new Date(form.insuranceExpires).toISOString(),
            bio:               clean(form.bio) || undefined,
          }),
        })
      } catch {
        throw new Error('Network error while submitting your registration. Please check your connection and try again.')
      }

      if (!res.ok) throw new Error(await readErrorBody(res))

      const data = await res.json()
      if (data?.stripe_onboarding_url) {
        window.location.href = data.stripe_onboarding_url
        return
      }
      router.push('/carrier')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit registration')
      setLoad(false)
    }
  }

  return (
    <div className="new-listing-page">
      <div className="nl-header">
        <h1 className="page-title">Carrier <span>Registration</span></h1>
        <p className="page-sub">Register your fleet to start bidding on equipment haul jobs</p>
      </div>

      <div className="nl-card">
        {/* ── COMPANY & AUTHORITY ── */}
        <div className="form-section">
          <h2 className="form-section-title">Company & Authority</h2>
          <div className="form-grid-2">
            <div className="form-field">
              <label>Company Name *</label>
              <input
                type="text"
                value={form.companyName}
                onChange={e => update('companyName', e.target.value)}
                placeholder="e.g. Permian Basin Hauling LLC"
                required
              />
            </div>
            <div className="form-field">
              <label>MC Number *</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.mcNumber}
                onChange={e => update('mcNumber', e.target.value.replace(/\D/g, ''))}
                placeholder="6–8 digits"
                required
              />
            </div>
            <div className="form-field">
              <label>DOT Number <span className="opt">(optional)</span></label>
              <input
                type="text"
                inputMode="numeric"
                value={form.dotNumber}
                onChange={e => update('dotNumber', e.target.value.replace(/\D/g, ''))}
                placeholder="7 digits"
              />
            </div>
            <div className="form-field">
              <label>Base State *</label>
              <select value={form.baseState} onChange={e => update('baseState', e.target.value)} required>
                <option value="">Select state</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-hint">
            Your MC and DOT numbers are verified against FMCSA records during registration.
          </div>
        </div>

        {/* ── EQUIPMENT ── */}
        <div className="form-section" style={{ marginTop: 24 }}>
          <h2 className="form-section-title">Equipment</h2>

          <div className="form-field" style={{ marginBottom: 18 }}>
            <label>Trailer Types *</label>
            <div className="type-selector">
              {TRAILER_OPTIONS.map(t => (
                <div
                  key={t.value}
                  className={`type-card ${form.trailerTypes.includes(t.value) ? 'selected' : ''}`}
                  onClick={() => toggleTrailer(t.value)}
                >
                  <div className="tc-label">{t.label}</div>
                  <div className="tc-desc">{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-field">
              <label>Max Load Capacity (tons) *</label>
              <input
                type="number"
                min={1}
                max={200}
                value={form.maxLoadTons}
                onChange={e => update('maxLoadTons', parseOptionalNumber(e.target.value))}
                placeholder="e.g. 40"
                required
              />
            </div>
          </div>
        </div>

        {/* ── SERVICE AREA ── */}
        <div className="form-section" style={{ marginTop: 24 }}>
          <h2 className="form-section-title">Service Area</h2>
          <p className="form-hint">Select every state where you accept haul jobs.</p>
          <div className="grade-selector" style={{ maxWidth: 'none', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))' }}>
            {US_STATES.map(s => (
              <button
                key={s}
                type="button"
                className={`grade-btn ${form.serviceStates.includes(s) ? 'selected' : ''}`}
                style={{ fontSize: 16 }}
                onClick={() => toggleServiceState(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="form-hint">
            {form.serviceStates.length} state{form.serviceStates.length !== 1 ? 's' : ''} selected
          </div>
        </div>

        {/* ── INSURANCE ── */}
        <div className="form-section" style={{ marginTop: 24 }}>
          <h2 className="form-section-title">Insurance</h2>
          <div className="form-grid-2">
            <div className="form-field">
              <label>Cargo Insurance Coverage ($) *</label>
              <input
                type="number"
                min={1_000_000}
                step={100_000}
                value={form.insuranceAmount}
                onChange={e => update('insuranceAmount', parseOptionalNumber(e.target.value))}
                placeholder="e.g. 1000000"
                required
              />
            </div>
            <div className="form-field">
              <label>Insurance Expiration Date *</label>
              <input
                type="date"
                value={form.insuranceExpires}
                onChange={e => update('insuranceExpires', e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-hint">A minimum of $1,000,000 in cargo coverage is required to haul on IRONBID.</div>
        </div>

        {/* ── ABOUT ── */}
        <div className="form-section" style={{ marginTop: 24 }}>
          <h2 className="form-section-title">About Your Fleet</h2>
          <div className="form-field">
            <label>Bio <span className="opt">(optional)</span></label>
            <textarea
              rows={5}
              value={form.bio}
              onChange={e => update('bio', e.target.value)}
              placeholder="Tell buyers and sellers about your experience, fleet size, and specialties..."
            />
          </div>
        </div>

        {error && <div className="form-error">⚠ {error}</div>}
      </div>

      <div className="nl-nav">
        <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Registration →'}
        </button>
      </div>
    </div>
  )
}
