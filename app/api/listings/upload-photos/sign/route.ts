// app/api/listings/upload-photos/sign/route.ts — Mint signed upload URLs so the
// browser can PUT directly to Supabase Storage, bypassing the Vercel serverless
// body size limit (~4.5MB) that would otherwise reject larger photos.
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserByClerkId, getListingById } from '@/lib/db'
import { createSignedUploadUrl, BUCKETS } from '@/lib/supabase'
import { isMockMode } from '@/lib/dev-mock'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
type AllowedType = typeof ALLOWED_TYPES[number]
const MAX_BYTES = 50 * 1024 * 1024
const MAX_FILES = 24

type SignRequest = {
  listingId?: unknown
  files?: unknown
}

type FileSpec = { name: string; type: AllowedType; size: number }

function extFor(type: AllowedType): string {
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[type]
}

function parseFiles(input: unknown): FileSpec[] | string {
  if (!Array.isArray(input)) return 'files must be an array'
  if (input.length === 0) return 'No files provided'
  if (input.length > MAX_FILES) return `Too many files (max ${MAX_FILES})`
  const out: FileSpec[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return 'Invalid file entry'
    const name = (raw as { name?: unknown }).name
    const type = (raw as { type?: unknown }).type
    const size = (raw as { size?: unknown }).size
    if (typeof name !== 'string' || !name) return 'File name is required'
    if (typeof type !== 'string' || !ALLOWED_TYPES.includes(type as AllowedType)) {
      return `Unsupported file type: ${typeof type === 'string' ? type : 'unknown'}`
    }
    if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
      return `File "${name}" has an invalid size`
    }
    if (size > MAX_BYTES) return `File "${name}" exceeds the 50MB limit`
    out.push({ name, type: type as AllowedType, size })
  }
  return out
}

export async function POST(req: Request) {
  let body: SignRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const listingId = body.listingId
  if (typeof listingId !== 'string' || !listingId) {
    return NextResponse.json({ error: 'listingId is required' }, { status: 422 })
  }

  const files = parseFiles(body.files)
  if (typeof files === 'string') {
    return NextResponse.json({ error: files }, { status: 422 })
  }

  if (isMockMode) {
    // In mock mode we don't have real storage; the client should fall back to
    // posting the file bodies to the legacy multipart endpoint.
    return NextResponse.json({ mock: true })
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

  const existingCount = Array.isArray(listing.photos) ? listing.photos.length : 0
  if (existingCount + files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Listing would exceed ${MAX_FILES} photos (currently ${existingCount}).` },
      { status: 422 },
    )
  }

  try {
    const stamp = Date.now()
    const uploads = await Promise.all(
      files.map(async (file, index) => {
        const path = `${listing.id}/${stamp}-${existingCount + index}.${extFor(file.type)}`
        const signed = await createSignedUploadUrl(BUCKETS.listingPhotos, path)
        return {
          name: file.name,
          path: signed.path,
          token: signed.token,
          signedUrl: signed.signedUrl,
        }
      }),
    )
    return NextResponse.json({ uploads })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to sign upload URLs'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
