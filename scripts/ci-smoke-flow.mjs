function parseArgs(argv) {
  const out = {}
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue
    const [key, value] = arg.slice(2).split('=')
    out[key] = value ?? 'true'
  }
  return out
}

async function expectJson(url, init) {
  const res = await fetch(url, init)
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${url} -> ${res.status}: ${text.slice(0, 280)}`)
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 280)}`)
  }
}

async function expectStatus(url, expected = 200) {
  const res = await fetch(url)
  if (res.status !== expected) {
    throw new Error(`GET ${url} -> ${res.status} (expected ${expected})`)
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const baseUrl = (args['base-url'] || process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3014').replace(/\/$/, '')
  const results = []

  async function step(name, fn) {
    try {
      const detail = await fn()
      results.push({ step: name, ok: true, detail: detail || 'ok' })
      return true
    } catch (err) {
      results.push({ step: name, ok: false, detail: err instanceof Error ? err.message : String(err) })
      return false
    }
  }

  const state = {
    listingId: null,
    auctionId: null,
    haulJobId: null,
    haulBidId: null,
  }

  await step('signup-page-reachable', async () => {
    await expectStatus(`${baseUrl}/auth/sign-up`, 200)
    return 'status=200'
  })

  await step('listing-page-reachable', async () => {
    await expectStatus(`${baseUrl}/dashboard/listings/new`, 200)
    return 'status=200'
  })

  await step('create-listing', async () => {
    const listing = await expectJson(`${baseUrl}/api/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'excavator',
        make: 'Hitachi',
        model: 'ZX200',
        year: 2021,
        description: 'CI smoke listing',
        locationCity: 'Denver',
        locationState: 'CO',
      }),
    })
    state.listingId = listing.id
    return `listingId=${listing.id}`
  })

  await step('upload-photos-endpoint', async () => {
    const upload = await expectJson(`${baseUrl}/api/listings/upload-photos`, { method: 'POST' })
    return `ok=${upload.ok}`
  })

  if (state.listingId) {
    await step('create-auction', async () => {
      const now = new Date()
      const auction = await expectJson(`${baseUrl}/api/auctions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: state.listingId,
          type: 'timed',
          startTime: now.toISOString(),
          endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          startingBid: 75000,
          minIncrement: 1000,
        }),
      })
      state.auctionId = auction.id
      return `auctionId=${auction.id}`
    })
  } else {
    results.push({ step: 'create-auction', ok: false, detail: 'skipped: listing not created' })
  }

  if (state.auctionId) {
    await step('get-auction-detail', async () => {
      const auction = await expectJson(`${baseUrl}/api/auctions/${state.auctionId}`, { method: 'GET' })
      return `id=${auction.id}`
    })

    await step('place-bid', async () => {
      const bid = await expectJson(`${baseUrl}/api/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auctionId: state.auctionId, amount: 76000 }),
      })
      return `bidId=${bid?.bid?.id} amount=${bid?.bid?.amount}`
    })
  } else {
    results.push({ step: 'get-auction-detail', ok: false, detail: 'skipped: auction not created' })
    results.push({ step: 'place-bid', ok: false, detail: 'skipped: auction not created' })
  }

  await step('create-haul-job', async () => {
    const job = await expectJson(`${baseUrl}/api/haul-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        pickup_address: '100 Mine Rd, Denver, CO',
        delivery_address: '500 Yard St, Cheyenne, WY',
        trailer_type: 'lowboy',
        special_requirements: ['escort if required'],
        bid_window_hrs: '24',
      }),
    })
    state.haulJobId = job.id
    return `haulJobId=${job.id}`
  })

  if (state.haulJobId) {
    await step('get-haul-job-detail', async () => {
      const job = await expectJson(`${baseUrl}/api/haul-jobs/${state.haulJobId}`, { method: 'GET' })
      return `id=${job.id}`
    })

    await step('submit-haul-quote', async () => {
      const bid = await expectJson(`${baseUrl}/api/haul-bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          haulJobId: state.haulJobId,
          amount: 3200,
          includesPermits: false,
          includesPilotCar: false,
          trailerType: 'lowboy',
        }),
      })
      state.haulBidId = bid.id
      return `haulBidId=${bid.id} amount=${bid.amount}`
    })
  } else {
    results.push({ step: 'get-haul-job-detail', ok: false, detail: 'skipped: haul job not created' })
    results.push({ step: 'submit-haul-quote', ok: false, detail: 'skipped: haul job not created' })
  }

  if (state.haulJobId && state.haulBidId) {
    await step('award-haul-bid', async () => {
      const award = await expectJson(`${baseUrl}/api/haul-jobs/${state.haulJobId}/award`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId: state.haulBidId }),
      })
      return `status=${award.status}`
    })

    await step('confirm-delivery-payment-release', async () => {
      const confirm = await expectJson(`${baseUrl}/api/haul-jobs/${state.haulJobId}/confirm-delivery`, {
        method: 'POST',
      })
      return `success=${confirm.success} mocked=${confirm.mocked}`
    })
  } else {
    results.push({ step: 'award-haul-bid', ok: false, detail: 'skipped: haul quote not submitted' })
    results.push({ step: 'confirm-delivery-payment-release', ok: false, detail: 'skipped: haul quote not submitted' })
  }

  const allPassed = results.every((item) => item.ok)
  console.log(JSON.stringify(results, null, 2))

  if (!allPassed) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
