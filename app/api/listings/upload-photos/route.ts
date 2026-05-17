import { NextResponse } from 'next/server'
import { getDevMockState, isMockMode } from '@/lib/dev-mock'

async function fileToDataUrl(file: File) {
  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mime = file.type || 'image/jpeg'
  return `data:${mime};base64,${base64}`
}

export async function POST(req: Request) {
  if (isMockMode) {
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      // Some smoke scripts ping this endpoint without multipart payload.
      return NextResponse.json({ ok: true, uploaded: [] })
    }
    const listingId = form.get('listingId')

    if (typeof listingId !== 'string' || !listingId) {
      return NextResponse.json({ ok: true, uploaded: [] })
    }

    const files = form.getAll('photos').filter((value): value is File => value instanceof File)
    if (files.length === 0) {
      return NextResponse.json({ ok: true, uploaded: [] })
    }

    const state = getDevMockState()
    const listing = state.listings.find((item) => item.id === listingId)
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    const existing = Array.isArray(listing.photos) ? listing.photos : []
    const uploaded = await Promise.all(
      files.map(async (file, index) => ({
        url: await fileToDataUrl(file),
        order: existing.length + index,
        caption: file.name || undefined,
      }))
    )

    listing.photos = [...existing, ...uploaded]
    return NextResponse.json({ ok: true, uploaded })
  }

  return NextResponse.json(
    { error: 'Photo upload endpoint is not configured in this environment' },
    { status: 501 }
  )
}
