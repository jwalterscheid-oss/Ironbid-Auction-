// app/api/listings/upload-photos/route.ts — Persist listing photos.
//
// Two flows are supported:
//
//   1. JSON finalize (production): the client first calls
//      /api/listings/upload-photos/sign to mint signed upload URLs, PUTs each
//      file directly to Supabase Storage, then POSTs the resulting object
//      paths here. This bypasses the Vercel serverless body limit so we can
//      accept files up to MAX_BYTES (50MB).
//
//   2. Multipart upload (mock/dev only): the client POSTs the raw file bodies
//      and we upload them through the service-role client. Kept so the dev
//      mock mode keeps working without real Supabase Storage.
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { db, getUserByClerkId, getListingById } from '@/lib/db'
import * as schema from '@/lib/schema'
import {
  uploadFile,
  getPublicUrl,
  readObjectHead,
  getObjectSize,
  BUCKETS,
} from '@/lib/supabase'
import { notifyError } from '@/lib/slack'
import { getDevMockState, isMockMode } from '@/lib/dev-mock'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
type AllowedType = typeof ALLOWED_TYPES[number]
const MAX_BYTES = 50 * 1024 * 1024 // 50MB per file
const MAX_FILES = 24

type Photo = { url: string; order: number; caption?: string }

function extFor(type: AllowedType): string {
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[type]
}

// Inspect the first bytes to confirm the file is actually the image type it
// claims to be. The client-declared MIME is attacker-controlled, so an
// `evil.svg` labeled `image/jpeg` would otherwise be served from a public
// Supabase bucket. Returns the verified MIME or null if no match.
function detectImageMime(buf: Uint8Array): AllowedType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    buf.length >= 6 &&
    buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61
  ) {
    return 'image/gif'
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // 'RIFF'
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50  // 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

function validateMultipart(files: File[]): string | null {
  if (files.length === 0) return 'No files provided'
  if (files.length > MAX_FILES) return `Too many files (max ${MAX_FILES})`
  for (const f of files) {
    if (!ALLOWED_TYPES.includes(f.type as AllowedType)) return `Unsupported file type: ${f.type || 'unknown'}`
    if (f.size > MAX_BYTES) return `File "${f.name}" exceeds the 50MB limit`
  }
  return null
}

async function sniffMimes(files: File[]): Promise<AllowedType[]> {
  return Promise.all(
    files.map(async (f) => {
      const head = new Uint8Array(await f.slice(0, 12).arrayBuffer())
      const detected = detectImageMime(head)
      if (!detected) {
        throw new Error(`File "${f.name}" is not a valid image`)
      }
      return detected
    }),
  )
}

async function fileToDataUrl(file: File) {
  const bytes = await file.arrayBuffer()
  return `data:${file.type};base64,${Buffer.from(bytes).toString('base64')}`
}

// ── Finalize path ──
type FinalizeEntry = { path: string; caption?: string }

function parseFinalize(body: unknown): FinalizeEntry[] | string {
  const photos = (body as { photos?: unknown })?.photos
  if (!Array.isArray(photos)) return 'photos must be an array'
  if (photos.length === 0) return 'No photos provided'
  if (photos.length > MAX_FILES) return `Too many photos (max ${MAX_FILES})`
  const out: FinalizeEntry[] = []
  for (const raw of photos) {
    if (!raw || typeof raw !== 'object') return 'Invalid photo entry'
    const path = (raw as { path?: unknown }).path
    const caption = (raw as { caption?: unknown }).caption
    if (typeof path !== 'string' || !path) return 'photo.path is required'
    out.push({ path, caption: typeof caption === 'string' ? caption : undefined })
  }
  return out
}

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || ''

  // ── JSON finalize flow ──
  if (contentType.includes('application/json')) {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const listingId = (body as { listingId?: unknown })?.listingId
    if (typeof listingId !== 'string' || !listingId) {
      return NextResponse.json({ error: 'listingId is required' }, { status: 422 })
    }

    const entries = parseFinalize(body)
    if (typeof entries === 'string') {
      return NextResponse.json({ error: entries }, { status: 422 })
    }

    const { userId: clerkId } = auth()
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await getUserByClerkId(clerkId)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const listing = await getListingById(listingId)
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    if (listing.sellerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existing: Photo[] = Array.isArray(listing.photos) ? listing.photos : []
    if (existing.length + entries.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Listing would exceed ${MAX_FILES} photos.` },
        { status: 422 },
      )
    }

    // Every path was issued by /sign for this listing, so confirm it lives
    // under the listing's prefix before we trust it.
    for (const entry of entries) {
      if (!entry.path.startsWith(`${listing.id}/`)) {
        return NextResponse.json({ error: 'Invalid photo path' }, { status: 422 })
      }
    }

    try {
      // Verify each uploaded object is actually a supported image and is
      // within the size limit. The user controlled the bytes that landed in
      // Storage, so we re-check after the fact.
      const uploaded: Photo[] = await Promise.all(
        entries.map(async (entry, index) => {
          const size = await getObjectSize(BUCKETS.listingPhotos, entry.path)
          if (size > MAX_BYTES) {
            throw new Error(`File "${entry.path}" exceeds the 50MB limit`)
          }
          const head = await readObjectHead(BUCKETS.listingPhotos, entry.path, 12)
          if (!detectImageMime(head)) {
            throw new Error(`File "${entry.path}" is not a valid image`)
          }
          return {
            url: getPublicUrl(BUCKETS.listingPhotos, entry.path),
            order: existing.length + index,
            caption: entry.caption,
          }
        }),
      )

      await db
        .update(schema.listings)
        .set({ photos: [...existing, ...uploaded], updatedAt: new Date() })
        .where(eq(schema.listings.id, listing.id))

      return NextResponse.json({ ok: true, uploaded })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Photo finalize failed'
      await notifyError({ context: 'Listing photo finalize', error: message, severity: 'medium' })
      return NextResponse.json({ error: message }, { status: 422 })
    }
  }

  // ── Multipart upload flow (mock/dev only) ──
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ ok: true, uploaded: [] })
  }

  const listingId = form.get('listingId')
  if (typeof listingId !== 'string' || !listingId) {
    return NextResponse.json({ error: 'listingId is required' }, { status: 422 })
  }

  const files = form.getAll('photos').filter((v): v is File => v instanceof File)

  if (isMockMode) {
    if (files.length === 0) return NextResponse.json({ ok: true, uploaded: [] })
    const validationError = validateMultipart(files)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 422 })

    const state = getDevMockState()
    const listing = state.listings.find((item) => item.id === listingId)
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

    const existing: Photo[] = Array.isArray(listing.photos) ? listing.photos : []
    const uploaded: Photo[] = await Promise.all(
      files.map(async (file, index) => ({
        url: await fileToDataUrl(file),
        order: existing.length + index,
        caption: file.name || undefined,
      })),
    )
    listing.photos = [...existing, ...uploaded]
    return NextResponse.json({ ok: true, uploaded })
  }

  // Production multipart path is retained as a last-resort fallback. The
  // Vercel body limit will block anything beyond ~4.5MB, so callers should
  // prefer the sign + JSON-finalize flow above.
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const listing = await getListingById(listingId)
  if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  if (listing.sellerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const validationError = validateMultipart(files)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 422 })

  let verifiedMimes: AllowedType[]
  try {
    verifiedMimes = await sniffMimes(files)
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid image' },
      { status: 422 },
    )
  }

  const existing: Photo[] = Array.isArray(listing.photos) ? listing.photos : []

  try {
    const uploaded: Photo[] = await Promise.all(
      files.map(async (file, index) => {
        const order = existing.length + index
        const path = `${listing.id}/${Date.now()}-${order}.${extFor(verifiedMimes[index])}`
        const url = await uploadFile(BUCKETS.listingPhotos, path, file)
        return { url, order, caption: file.name || undefined }
      }),
    )

    await db
      .update(schema.listings)
      .set({ photos: [...existing, ...uploaded], updatedAt: new Date() })
      .where(eq(schema.listings.id, listing.id))

    return NextResponse.json({ ok: true, uploaded })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Photo upload failed'
    await notifyError({ context: 'Listing photo upload', error: message, severity: 'medium' })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
