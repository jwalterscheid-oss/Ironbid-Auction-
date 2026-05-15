const target = process.argv[2]
const timeoutMs = Number(process.argv[3] ?? 90000)
const started = Date.now()

if (!target) {
  console.error('Usage: node scripts/wait-for-url.mjs <url> [timeoutMs]')
  process.exit(1)
}

async function waitForUrl() {
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(target)
      if (res.ok || res.status === 404) {
        console.log(`Ready: ${target} (${res.status})`)
        return
      }
    } catch {
      // keep polling
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  console.error(`Timed out waiting for ${target} after ${timeoutMs}ms`)
  process.exit(1)
}

waitForUrl()
