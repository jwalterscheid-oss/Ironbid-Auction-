/**
 * stripe-webhook-create.js
 *
 * Creates a Stripe webhook endpoint subscribed to every event that
 * /api/webhooks/stripe handles, then writes the new endpoint id and signing
 * secret into .env.local.
 *
 * Usage:
 *   node scripts/stripe-webhook-create.js https://app.example.com/api/webhooks/stripe
 *
 * Requires STRIPE_SECRET_KEY in .env.local (sk_test_... or sk_live_...).
 * After running, copy STRIPE_WEBHOOK_ENDPOINT_ID and STRIPE_WEBHOOK_SECRET
 * into the Vercel project environment variables and redeploy.
 */
const fs = require('fs')
const { config: loadEnv } = require('dotenv')

loadEnv({ path: '.env.local', override: true })
loadEnv({ override: true })

const Stripe = require('stripe')

const EVENTS = [
  'checkout.session.completed',
  'payment_intent.succeeded',
  'account.updated',
  'transfer.created',
  'identity.verification_session.verified',
  'identity.verification_session.requires_input',
]

function setEnvVar(content, key, value) {
  const line = `${key}=${value}`
  const re = new RegExp(`^${key}=.*$`, 'm')
  return re.test(content)
    ? content.replace(re, line)
    : `${content.replace(/\s*$/, '')}\n${line}\n`
}

async function main() {
  const url = process.argv[2]
  if (!url) throw new Error('Usage: node scripts/stripe-webhook-create.js <webhook-url>')

  const key = process.env.STRIPE_SECRET_KEY
  if (!/^sk_(test|live)_/.test(key || '')) {
    throw new Error('STRIPE_SECRET_KEY is missing or not a valid Stripe secret key.')
  }

  const stripe = new Stripe(key, { apiVersion: '2023-10-16' })

  const endpoint = await stripe.webhookEndpoints.create({
    url,
    enabled_events: EVENTS,
    description: 'IronBid app webhook',
  })

  let env = fs.readFileSync('.env.local', 'utf8')
  env = setEnvVar(env, 'STRIPE_WEBHOOK_ENDPOINT_ID', endpoint.id)
  env = setEnvVar(env, 'STRIPE_WEBHOOK_SECRET', endpoint.secret)
  fs.writeFileSync('.env.local', env)

  console.log('Created webhook endpoint:', endpoint.id)
  console.log('URL:', endpoint.url)
  console.log('Mode:', endpoint.livemode ? 'LIVE' : 'TEST')
  console.log('Subscribed events:', endpoint.enabled_events.length)
  endpoint.enabled_events.forEach((e) => console.log('  -', e))
  console.log('')
  console.log('Wrote STRIPE_WEBHOOK_ENDPOINT_ID and STRIPE_WEBHOOK_SECRET to .env.local')
  console.log('Signing secret prefix:', `${endpoint.secret.slice(0, 11)}...`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
