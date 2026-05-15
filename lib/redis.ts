// lib/redis.ts — Redis client via Upstash
import Redis from 'ioredis'

const globalForRedis = globalThis as unknown as { redis?: Redis }

function isLikelyPlaceholder(value: string) {
  return value.includes('[') || value.includes(']') || value.includes('PASSWORD') || value.includes('HOST')
}

const configuredRedisUrl = process.env.REDIS_URL
const redisUrl =
  configuredRedisUrl && /^rediss?:\/\//.test(configuredRedisUrl) && !isLikelyPlaceholder(configuredRedisUrl)
    ? configuredRedisUrl
    : 'redis://127.0.0.1:6379'

const isLocalFallbackRedis = redisUrl.includes('127.0.0.1:6379') || redisUrl.includes('localhost:6379')

export const redis =
  globalForRedis.redis ??
  new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy(times) {
      // Avoid noisy reconnect loops when local Redis is not running in development/build.
      if (isLocalFallbackRedis && process.env.NODE_ENV !== 'production') return null
      return Math.min(times * 50, 2000)
    },
  })

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

if (isLocalFallbackRedis && process.env.NODE_ENV !== 'production') {
  let logged = false
  redis.on('error', () => {
    if (!logged) {
      console.warn('[redis] Local Redis not available at 127.0.0.1:6379; continuing without reconnect retries.')
      logged = true
    }
  })
}

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
