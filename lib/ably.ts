// lib/ably.ts — Ably server-side client + token generation
import Ably from 'ably'

export const ablyServer = new Ably.Rest(process.env.ABLY_API_KEY!)

// ── Generate short-lived token for browser clients ──
export async function createAblyToken(userId: string) {
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
  return ablyServer.auth.createTokenRequest(tokenParams)
}

export async function createCarrierAblyToken(carrierId: string) {
  const tokenParams = {
    clientId: carrierId,
    capability: {
      'haul-jobs:available': ['subscribe'],
      [`carrier:${carrierId}:*`]: ['subscribe', 'publish'],
    } as Record<string, ("subscribe" | "publish")[]>,
  }
  return ablyServer.auth.createTokenRequest(tokenParams)
}

// ── Publish to a channel from server ──
export async function publishToChannel(channel: string, event: string, data: object) {
  const ch = ablyServer.channels.get(channel)
  return ch.publish(event, data)
}
