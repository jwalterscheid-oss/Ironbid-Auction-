// lib/slack.ts — Slack notifications for key platform events
import { WebClient } from '@slack/web-api'
import type { Block, KnownBlock } from '@slack/types'

type SlackBlocks = Array<KnownBlock | Block>

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

const CH = {
  bids:   process.env.SLACK_CHANNEL_BIDS   ?? '#ironbid-bids',
  alerts: process.env.SLACK_CHANNEL_ALERTS ?? '#ironbid-alerts',
  sales:  process.env.SLACK_CHANNEL_SALES  ?? '#ironbid-sales',
  haul:   process.env.SLACK_CHANNEL_HAUL   ?? '#ironbid-haul',
  errors: process.env.SLACK_CHANNEL_ERRORS ?? '#ironbid-errors',
} as const

// ── Core post helper ──
async function post(channel: string, text: string, blocks?: SlackBlocks) {
  try {
    await slack.chat.postMessage({ channel, text, blocks, unfurl_links: false })
  } catch (err) {
    // Silently swallow — Slack is non-critical
    console.error('[Slack]', err)
  }
}

// ────────────────────────────────────────
// BID EVENTS
// ────────────────────────────────────────

export async function notifyNewBid(params: {
  lotNumber: string
  equipmentName: string
  amount: number
  bidderMasked: string
  totalBids: number
  auctionId: string
}) {
  const { lotNumber, equipmentName, amount, bidderMasked, totalBids } = params
  await post(CH.bids, `💰 New bid on ${lotNumber}`, [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*💰 New Bid — ${lotNumber}*\n${equipmentName}` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Amount*\n$${amount.toLocaleString()}` },
        { type: 'mrkdwn', text: `*Bidder*\n${bidderMasked}` },
        { type: 'mrkdwn', text: `*Total Bids*\n${totalBids}` },
      ],
    },
    {
      type: 'actions',
      elements: [{
        type: 'button',
        text: { type: 'plain_text', text: 'View Auction' },
        url: `${process.env.NEXT_PUBLIC_APP_URL}/auctions/${params.auctionId}`,
      }],
    },
  ])
}

export async function notifyAuctionClosed(params: {
  lotNumber: string
  equipmentName: string
  finalPrice: number
  winnerMasked: string
  totalBids: number
  reserveMet: boolean
}) {
  const emoji = params.reserveMet ? '🏆' : '⚠️'
  const status = params.reserveMet ? 'SOLD' : 'RESERVE NOT MET'
  await post(CH.sales, `${emoji} Auction closed: ${params.lotNumber}`, [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} Auction Closed — ${status}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${params.equipmentName}* · Lot ${params.lotNumber}` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Hammer Price*\n$${params.finalPrice.toLocaleString()}` },
        { type: 'mrkdwn', text: `*Winner*\n${params.winnerMasked}` },
        { type: 'mrkdwn', text: `*Total Bids*\n${params.totalBids}` },
        { type: 'mrkdwn', text: `*Buyer's Premium (12%)*\n$${Math.round(params.finalPrice * 0.12).toLocaleString()}` },
      ],
    },
  ])
}

// ────────────────────────────────────────
// PAYMENT EVENTS
// ────────────────────────────────────────

export async function notifyPaymentReceived(params: {
  lotNumber: string
  buyerName: string
  amount: number
  method: string
}) {
  await post(CH.sales, `✅ Payment received for ${params.lotNumber}`, [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*✅ Payment Confirmed*\nLot ${params.lotNumber} — *$${params.amount.toLocaleString()}* via ${params.method}\nBuyer: ${params.buyerName}`,
      },
    },
  ])
}

export async function notifyPaymentOverdue(params: {
  lotNumber: string
  buyerName: string
  amount: number
  hoursOverdue: number
}) {
  await post(CH.alerts, `🚨 Payment overdue: ${params.lotNumber}`, [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🚨 Payment Overdue*\nLot ${params.lotNumber} · ${params.hoursOverdue}hrs past deadline\nBuyer: ${params.buyerName} · Amount: $${params.amount.toLocaleString()}`,
      },
    },
  ])
}

// ────────────────────────────────────────
// HAUL EVENTS
// ────────────────────────────────────────

export async function notifyHaulJobPosted(params: {
  jobId: string
  lotNumber: string
  equipment: string
  route: string
  distanceMiles: number
  matchedCarriers: number
}) {
  await post(CH.haul, `🚛 New haul job posted: ${params.lotNumber}`, [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*🚛 Haul Job Posted — ${params.lotNumber}*\n${params.equipment}` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Route*\n${params.route}` },
        { type: 'mrkdwn', text: `*Distance*\n${params.distanceMiles} miles` },
        { type: 'mrkdwn', text: `*Carriers Notified*\n${params.matchedCarriers}` },
      ],
    },
  ])
}

export async function notifyHaulAwarded(params: {
  jobId: string
  lotNumber: string
  carrierName: string
  amount: number
  etaDays: number
}) {
  await post(CH.haul, `✅ Haul awarded: ${params.lotNumber}`, [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*✅ Haul Awarded — ${params.lotNumber}*\nCarrier: ${params.carrierName}\nAmount: $${params.amount.toLocaleString()} · ETA: ${params.etaDays} days`,
      },
    },
  ])
}

export async function notifyHaulDelivered(params: {
  jobId: string
  lotNumber: string
  carrierName: string
  payoutAmount: number
}) {
  await post(CH.haul, `🏁 Delivery confirmed: ${params.lotNumber}`, [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🏁 Delivery Confirmed — ${params.lotNumber}*\nCarrier: ${params.carrierName} · Payout: $${params.payoutAmount.toLocaleString()} released`,
      },
    },
  ])
}

// ────────────────────────────────────────
// USER EVENTS
// ────────────────────────────────────────

export async function notifyNewUserRegistered(params: {
  name: string
  email: string
  role: string
  company?: string
}) {
  await post(CH.alerts, `👤 New ${params.role} registered`, [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*👤 New ${params.role.toUpperCase()} Registered*\n${params.name} · ${params.email}${params.company ? `\nCompany: ${params.company}` : ''}`,
      },
    },
  ])
}

export async function notifyCarrierVerified(params: {
  carrierName: string
  mcNumber: string
  email: string
}) {
  await post(CH.alerts, `✅ Carrier verified: ${params.carrierName}`, [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*✅ Carrier Verified*\n${params.carrierName} · MC# ${params.mcNumber}\n${params.email}`,
      },
    },
  ])
}

// ────────────────────────────────────────
// ERROR EVENTS
// ────────────────────────────────────────

export async function notifyError(params: {
  context: string
  error: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  data?: Record<string, unknown>
}) {
  const emoji = { low: '⚠️', medium: '🟠', high: '🔴', critical: '🚨' }[params.severity]
  await post(CH.errors, `${emoji} Error: ${params.context}`, [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${emoji} ${params.severity.toUpperCase()} Error — ${params.context}*\n\`\`\`${params.error.slice(0, 500)}\`\`\`${params.data ? `\n*Context:* ${JSON.stringify(params.data)}` : ''}`,
      },
    },
  ])
}
