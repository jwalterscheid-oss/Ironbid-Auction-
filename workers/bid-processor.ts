// workers/bid-processor.ts — BullMQ worker for serialized bid processing
import { Worker, Queue, QueueEvents } from 'bullmq'
import { redis } from '../lib/redis'
import { validateBid, processBid, closeAuction } from '../lib/auction/bid-processor'
import { notifyError } from '../lib/slack'

const connection = redis

// ── QUEUES ──────────────────────────────────────────────────────────────────
export const bidQueue = new Queue('bids', {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 1000,
    attempts: 1, // bids are never retried — idempotency issue
  },
})

export const auctionCloseQueue = new Queue('auction-close', {
  connection,
  defaultJobOptions: { removeOnComplete: true, attempts: 3 },
})

export const queueEvents = new QueueEvents('bids', { connection })

// ── BID WORKER ──────────────────────────────────────────────────────────────
const bidWorker = new Worker(
  'bids',
  async (job) => {
    const { auctionId, userId, amount, maxBid, ipAddress } = job.data

    // Re-validate at processing time (state may have changed in queue)
    const validation = await validateBid({ auctionId, userId, amount })
    if ('error' in validation) {
      throw new Error(validation.error)
    }

    return processBid({ auctionId, userId, amount, maxBid, ipAddress })
  },
  {
    connection,
    concurrency: 1,         // ← CRITICAL: process one bid at a time per queue
    lockDuration: 10_000,
  }
)

bidWorker.on('failed', async (job, err) => {
  if (!job) return
  console.error(`[BidWorker] Job ${job.id} failed:`, err.message)
  await notifyError({
    context: 'Bid processing failed',
    error:   err.message,
    severity: 'high',
    data: { auctionId: job.data.auctionId, amount: job.data.amount },
  }).catch(() => {})
})

// ── AUCTION CLOSE WORKER ────────────────────────────────────────────────────
const closeWorker = new Worker(
  'auction-close',
  async (job) => {
    const { auctionId } = job.data
    console.log(`[CloseWorker] Closing auction ${auctionId}`)
    await closeAuction(auctionId)
  },
  { connection, concurrency: 5 }
)

closeWorker.on('failed', async (job, err) => {
  if (!job) return
  console.error(`[CloseWorker] Job ${job.id} failed:`, err.message)
  await notifyError({
    context: 'Auction close failed',
    error:   err.message,
    severity: 'critical',
    data: { auctionId: job.data.auctionId },
  }).catch(() => {})
})

console.log('[Workers] Bid processor and auction closer running...')
