// components/auction/BiddingPanel.tsx — 'use client' live bidding UI
'use client'
import { useState } from 'react'
import { useAuction } from '@/hooks/useAuction'

interface Props {
  auctionId:        string
  initialBid:       number
  bidCount:         number
  buyersPremiumPct: number
  reserveMet:       boolean
  minIncrement:     number
  buyNowPrice?:     number
  currentUserId?:   string
  currentWinnerId?: string
  isVerified:       boolean
}

export function BiddingPanel({
  auctionId, initialBid, bidCount, buyersPremiumPct,
  reserveMet, minIncrement, buyNowPrice, currentUserId,
  currentWinnerId, isVerified,
}: Props) {
  const { state, bidState, placeBid } = useAuction(auctionId, {
    currentBid:  initialBid,
    bidCount,
    reserveMet,
    currentWinnerId,
    status:      'active',
  })

  const currentBid  = state.currentBid ?? initialBid
  const increment   = minIncrement
  const isWinning = Boolean(currentUserId && state.currentWinnerId === currentUserId)

  const INCREMENTS = [increment, increment * 2.5, increment * 5, increment * 10]

  const [selectedAmount, setSelectedAmount] = useState(currentBid + increment)
  const [customInput, setCustomInput]       = useState('')
  const [autobidMax, setAutobidMax]         = useState('')
  const [autobidOn, setAutobidOn]           = useState(false)
  const [justBid, setJustBid]               = useState(false)

  const bidAmount = customInput ? Number(customInput) : selectedAmount
  const premium   = Math.round(bidAmount * (buyersPremiumPct / 100))
  const totalDue  = bidAmount + premium

  async function handleBid() {
    if (!isVerified) {
      alert('Please complete identity verification before bidding.')
      return
    }
    const result = await placeBid(bidAmount, autobidOn && autobidMax ? Number(autobidMax) : undefined)
    if (result.success) {
      setJustBid(true)
      setTimeout(() => setJustBid(false), 2500)
    }
  }

  const isClosed   = state.status === 'closed' || state.status === 'cancelled'
  const buttonText = isClosed
    ? 'AUCTION CLOSED'
    : justBid
      ? '✓ BID CONFIRMED!'
      : bidState.isSubmitting
        ? 'PLACING BID...'
        : `PLACE BID — $${bidAmount.toLocaleString()}`

  return (
    <div className="bid-panel">
      {/* Current bid */}
      <div className="current-bid-block">
        <div className="cb-label">Current Bid</div>
        <div className={`cb-amount ${isWinning ? 'winning' : ''}`}>
          ${currentBid.toLocaleString()}
        </div>
        <div className="cb-meta">
          <span>Bids: {state.bidCount ?? bidCount}</span>
          <span>Reserve: {state.reserveMet ? <span className="green">Met ✓</span> : 'Not met'}</span>
          <span>Premium: {buyersPremiumPct}%</span>
        </div>
      </div>

      {/* Winning / outbid status */}
      {currentUserId && (
        <div className={`status-bar ${isWinning ? 'winning' : 'outbid'}`}>
          <div className="sb-dot" />
          {isWinning ? 'YOU ARE WINNING' : state.currentBid !== initialBid ? 'YOU HAVE BEEN OUTBID' : ''}
        </div>
      )}

      {/* Bid increment buttons */}
      {!isClosed && (
        <>
          <div className="bid-options">
            {INCREMENTS.map(inc => {
              const amt = currentBid + inc
              return (
                <button
                  key={inc}
                  className={`bid-option ${selectedAmount === amt && !customInput ? 'selected' : ''}`}
                  onClick={() => { setSelectedAmount(amt); setCustomInput('') }}
                >
                  <span className="bo-amount">${amt.toLocaleString()}</span>
                  <span className="bo-inc">+${inc.toLocaleString()}</span>
                </button>
              )
            })}
          </div>

          <div className="custom-bid-row">
            <span className="cb-prefix">$</span>
            <input
              type="number"
              className="custom-input"
              placeholder="Custom amount"
              value={customInput}
              min={currentBid + increment}
              onChange={e => setCustomInput(e.target.value)}
            />
          </div>

          <button
            className={`place-bid-btn ${justBid ? 'confirmed' : ''} ${bidState.isSubmitting ? 'loading' : ''}`}
            onClick={handleBid}
            disabled={isClosed || bidState.isSubmitting}
          >
            {buttonText}
          </button>

          {bidState.lastError && (
            <div className="bid-error">⚠ {bidState.lastError}</div>
          )}

          {/* Autobid toggle */}
          <div className="autobid-row">
            <button
              className={`toggle ${autobidOn ? 'on' : ''}`}
              onClick={() => setAutobidOn(v => !v)}
            />
            <span className="toggle-label"><strong>Auto-bid</strong> — bid automatically up to your max</span>
          </div>
          {autobidOn && (
            <div className="autobid-max-row">
              <span className="cb-prefix">$</span>
              <input
                type="number"
                className="custom-input"
                placeholder="Your maximum bid"
                value={autobidMax}
                onChange={e => setAutobidMax(e.target.value)}
              />
            </div>
          )}
        </>
      )}

      {/* Buy now */}
      {buyNowPrice && !isClosed && (
        <button className="buy-now-btn">
          BUY NOW — ${buyNowPrice.toLocaleString()}
        </button>
      )}

      {/* Buyer's premium breakdown */}
      <div className="premium-summary">
        <div className="ps-row">
          <span>Your bid</span>
          <span>${bidAmount.toLocaleString()}</span>
        </div>
        <div className="ps-row">
          <span>Buyer&apos;s Premium ({buyersPremiumPct}%)</span>
          <span>${premium.toLocaleString()}</span>
        </div>
        <div className="ps-row total">
          <span>Estimated Total</span>
          <strong>${totalDue.toLocaleString()}</strong>
        </div>
        <div className="ps-note">Excl. taxes, transport, title fees</div>
      </div>
    </div>
  )
}
