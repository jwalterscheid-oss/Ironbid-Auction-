// app/api/ably-token/route.ts — Token auth for browser WebSocket clients
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAblyToken, createCarrierAblyToken } from '@/lib/ably'
import { getUserByClerkId } from '@/lib/db'
import { mockUserIdForRole } from '@/lib/dev-mock'

export async function GET() {
  const { userId: clerkUserId } = auth()
  const devAuthBypass = process.env.DEV_AUTH_BYPASS === 'true'
  const clerkId = clerkUserId ?? (devAuthBypass ? 'dev-bypass-user' : null)

  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (devAuthBypass) {
    try {
      const tokenRequest = await createAblyToken(mockUserIdForRole('buyer'))
      return NextResponse.json(tokenRequest)
    } catch {
      return NextResponse.json(
        { error: 'Realtime service unavailable' },
        { status: 503 }
      )
    }
  }

  const user = await getUserByClerkId(clerkId)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    const tokenRequest = user.role === 'carrier'
      ? await createCarrierAblyToken(user.id)
      : await createAblyToken(user.id)

    return NextResponse.json(tokenRequest)
  } catch {
    return NextResponse.json(
      { error: 'Realtime service unavailable' },
      { status: 503 }
    )
  }
}
