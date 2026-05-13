import { NextResponse } from 'next/server'
import { isMockMode } from '@/lib/dev-mock'

export async function POST() {
  if (isMockMode) {
    return NextResponse.json({ ok: true, uploaded: [] })
  }

  return NextResponse.json(
    { error: 'Photo upload endpoint is not configured in this environment' },
    { status: 501 }
  )
}
