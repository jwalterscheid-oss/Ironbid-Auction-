// lib/ably.ts — Ably server-side client + token generation
import Ably from 'ably'

let ablyServer: Ably.Rest | null = null

function getAblyServer() {
  if (ablyServer) return ablyServer

  const apiKey = process.env.ABLY_API_KEY
  if (!apiKey || !apiKey.includes(':')) {
    throw new Error('ABLY_API_KEY is missing or invalid')
  }

  ablyServer = new Ably.Rest(apiKey)
  return ablyServer
}

// ── Generate short-lived token for browser clients ──
export async function createAblyToken(userId: string) {
  const client = getAblyServer()
  const tokenParams = {
    clientId: userId,
    capability: {
      // Buyers can subscribe to auction & haul channels
      'auction:*': ['subscribe'],
      [`haul:${userId}:*`]: ['subscribe'],
      // Private per-user channel for outbid/win notifications
      [`private:${userId}`]: ['subscribe'],
    } as Record<string, ("subscribe" | "publish")[]>,
  }
  return client.auth.createTokenRequest(tokenParams)
}

export async function createCarrierAblyToken(carrierId: string) {
  const client = getAblyServer()
  const tokenParams = {
    clientId: carrierId,
    capability: {
      // Carrier users can still view live auction channels.
      'auction:*': ['subscribe'],
      'haul-jobs:available': ['subscribe'],
      [`carrier:${carrierId}:*`]: ['subscribe', 'publish'],
    } as Record<string, ("subscribe" | "publish")[]>,
  }
  return client.auth.createTokenRequest(tokenParams)
}

// ── Publish to a channel from server ──
export async function publishToChannel(channel: string, event: string, data: object) {
  const client = getAblyServer()
  const ch = client.channels.get(channel)
  return ch.publish(event, data)
}
