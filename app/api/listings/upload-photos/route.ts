// app/api/listings/upload-photos/route.ts — Upload listing photos to Supabase Storage
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { db, getUserByClerkId, getListingById } from '@/lib/db'
import * as schema from '@/lib/schema'
import { uploadFile, BUCKETS } from '@/lib/supabase'
import { notifyError } from '@/lib/slack'
import { getDevMockState, isMockMode } from '@/lib/dev-mock'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024 // 10MB per file
const MAX_FILES = 24

type Photo = { url: string; order: number; caption?: string }

function extFor(type: string): string {
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[type] ?? 'jpg'
}

function validate(files: File[]): string | null {
  if (files.length === 0) return 'No files provided'
  if (files.length > MAX_FILES) return `Too many files (max ${MAX_FILES})`
  for (const f of files) {
    if (!ALLOWED_TYPES.includes(f.type)) return `Unsupported file type: ${f.type || 'unknown'}`
    if (f.size > MAX_BYTES) return `File "${f.name}" exceeds the 10MB limit`
  }
  return null
}

async function fileToDataUrl(file: File) {
  const bytes = await file.arrayBuffer()
  return `data:${file.type};base64,${Buffer.from(bytes).toString('base64')}`
}

export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    // Some smoke scripts ping this endpoint without a multipart payload.
    return NextResponse.json({ ok: true, uploaded: [] })
  }

  const listingId = form.get('listingId')
  if (typeof listingId !== 'string' || !listingId) {
    return NextResponse.json({ error: 'listingId is required' }, { status: 422 })
  }

  const files = form.getAll('photos').filter((v): v is File => v instanceof File)

  if (isMockMode) {
    if (files.length === 0) return NextResponse.json({ ok: true, uploaded: [] })
    const validationError = validate(files)
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
      }))
    )
    listing.photos = [...existing, ...uploaded]
    return NextResponse.json({ ok: true, uploaded })
  }

  // ── Auth + ownership ──
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const listing = await getListingById(listingId)
  if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  if (listing.sellerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const validationError = validate(files)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 422 })

  const existing: Photo[] = Array.isArray(listing.photos) ? listing.photos : []

  try {
    const uploaded: Photo[] = await Promise.all(
      files.map(async (file, index) => {
        const order = existing.length + index
        const path = `${listing.id}/${Date.now()}-${order}.${extFor(file.type)}`
        const url = await uploadFile(BUCKETS.listingPhotos, path, file)
        return { url, order, caption: file.name || undefined }
      })
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
