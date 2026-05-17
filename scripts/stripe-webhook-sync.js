/**
 * stripe-webhook-sync.js
 *
 * Idempotently ensures the Stripe webhook endpoint is subscribed to all
 * events that /api/webhooks/stripe handles. Run this once after deploy or
 * whenever you add new event handlers.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY          – sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_ENDPOINT_ID – we_... (from Stripe Dashboard → Developers → Webhooks)
 *
 * Usage:
 *   node scripts/stripe-webhook-sync.js
 */

const { config: loadEnv } = require('dotenv')

loadEnv({ path: '.env.local', override: true })
loadEnv({ override: true })

const Stripe = require('stripe')

const REQUIRED_EVENTS = [
  'checkout.session.completed',
  'payment_intent.succeeded',
  'account.updated',
  'transfer.created',
  'identity.verification_session.verified',
  'identity.verification_session.requires_input',
]

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const endpointId = process.env.STRIPE_WEBHOOK_ENDPOINT_ID

  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not set.')
  if (!endpointId) throw new Error('STRIPE_WEBHOOK_ENDPOINT_ID is not set (e.g. we_...).')

  const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' })

  // Fetch the existing endpoint so we can merge its current events.
  const existing = await stripe.webhookEndpoints.retrieve(endpointId)

  const currentEvents = new Set(existing.enabled_events ?? [])
  const missingEvents = REQUIRED_EVENTS.filter((e) => !currentEvents.has(e))

  if (missingEvents.length === 0) {
    console.log('Webhook endpoint already subscribed to all required events. Nothing to do.')
    return
  }

  const mergedEvents = Array.from(new Set([...currentEvents, ...REQUIRED_EVENTS]))

  console.log(`Adding events: ${missingEvents.join(', ')}`)

  const updated = await stripe.webhookEndpoints.update(endpointId, {
    enabled_events: mergedEvents,
  })

  console.log(`\nWebhook endpoint ${updated.id} now subscribed to:`)
  for (const evt of updated.enabled_events) {
    const isNew = missingEvents.includes(evt)
    console.log(`  ${isNew ? '+ ' : '  '}${evt}`)
  }

  console.log('\nDone. Copy the signing secret (whsec_...) from the Dashboard and set STRIPE_WEBHOOK_SECRET.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
