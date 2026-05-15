import { promises as fs } from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const appDir = path.join(rootDir, 'app')

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(full)))
    } else {
      files.push(full)
    }
  }
  return files
}

function routeFromPageFile(filePath) {
  const rel = path.relative(appDir, filePath).replace(/\\/g, '/')
  const dir = rel.replace(/\/page\.tsx$/, '')
  const segments = dir.split('/').filter(Boolean).filter((segment) => !/^\(.*\)$/.test(segment))
  return '/' + segments.join('/')
}

function normalizeRoute(route) {
  if (!route.startsWith('/')) return `/${route}`
  return route
}

function isDynamicSegment(segment) {
  return /^\[.*\]$/.test(segment)
}

function routeMatchesCandidate(route, candidate) {
  const a = route.split('/').filter(Boolean)
  const b = candidate.split('/').filter(Boolean)
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === b[i]) continue
    if (isDynamicSegment(b[i])) continue
    return false
  }
  return true
}

function extractLinkedRoutes(source) {
  const routes = new Set()

  const objectHrefRegex = /href:\s*'([^']+)'/g
  let match = objectHrefRegex.exec(source)
  while (match) {
    const route = normalizeRoute(match[1])
    if (route.startsWith('/dashboard') || route.startsWith('/carrier')) {
      routes.add(route)
    }
    match = objectHrefRegex.exec(source)
  }

  const jsxHrefRegex = /<Link\s+href="([^"]+)"/g
  match = jsxHrefRegex.exec(source)
  while (match) {
    const route = normalizeRoute(match[1])
    if (route.startsWith('/dashboard') || route.startsWith('/carrier')) {
      routes.add(route)
    }
    match = jsxHrefRegex.exec(source)
  }

  return [...routes]
}

async function main() {
  const pageFiles = (await walk(appDir)).filter((file) => /\/page\.tsx$/.test(file.replace(/\\/g, '/')))
  const appRoutes = new Set(pageFiles.map(routeFromPageFile))

  const sources = [
    path.join(rootDir, 'components', 'layout', 'DashboardSidebar.tsx'),
    path.join(rootDir, 'components', 'layout', 'TopNav.tsx'),
  ]

  const linkedRoutes = new Set()
  for (const sourcePath of sources) {
    const source = await fs.readFile(sourcePath, 'utf8')
    extractLinkedRoutes(source).forEach((route) => linkedRoutes.add(route))
  }

  const missing = []
  for (const route of linkedRoutes) {
    if (appRoutes.has(route)) continue

    const hasDynamicMatch = [...appRoutes].some((candidate) => routeMatchesCandidate(route, candidate))
    if (!hasDynamicMatch) missing.push(route)
  }

  if (missing.length > 0) {
    console.error('Missing routes referenced by dashboard/carrier navigation:')
    for (const route of missing) {
      console.error(` - ${route}`)
    }
    process.exit(1)
  }

  console.log(`Route guard passed. Checked ${linkedRoutes.size} linked routes.`)
}

main().catch((err) => {
  console.error('Route guard failed:', err)
  process.exit(1)
})
