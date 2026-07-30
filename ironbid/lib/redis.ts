// lib/redis.ts — Redis client via Upstash
import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as { redis?: Redis }

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  })

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

// ── Auction state helpers ──
export const AUCTION_KEY = (id: string) => `auction:${id}`
export const AUTOBID_KEY = (id: string) => `autobid:${id}`
export const HAUL_JOB_KEY = (id: string) => `haul:${id}`

export async function getAuctionState(auctionId: string) {
  return redis.hgetall(AUCTION_KEY(auctionId))
}

export async function setAuctionState(auctionId: string, state: Record<string, string | number>) {
  return redis.hset(AUCTION_KEY(auctionId), state)
}

export async function publishBidEvent(auctionId: string, payload: object) {
  return redis.publish(`bid_placed:${auctionId}`, JSON.stringify(payload))
}

export async function publishHaulEvent(jobId: string, event: string, payload: object) {
  return redis.publish(`haul:${event}:${jobId}`, JSON.stringify(payload))
}
