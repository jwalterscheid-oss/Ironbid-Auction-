// app/api/onboarding/set-role/route.ts — Set user role during onboarding
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { z } from 'zod'
import { db, getUserByClerkId, upsertUserFromClerk } from '@/lib/db'
import { eq } from 'drizzle-orm'
import * as schema from '@/lib/schema'
import { isMockMode } from '@/lib/dev-mock'

export async function POST(req: NextRequest) {
  try {
    // 'dealer' and 'admin' are privileged roles granted out-of-band, never
    // self-assigned during onboarding.
    const parsed = z.object({
      role: z.enum(['buyer', 'seller', 'carrier']),
    }).safeParse(await req.json())

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid role payload' }, { status: 400 })
    }

    const { role } = parsed.data
    const devAuthBypass =
      process.env.DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production'

    if (isMockMode) {
      return NextResponse.json({ ok: true, mocked: true, role })
    }

    let { userId: clerkId } = auth()
    if (!clerkId && devAuthBypass) {
      clerkId = 'dev-bypass-user'
    }

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let user = await getUserByClerkId(clerkId)

    if (!user) {
      if (devAuthBypass) {
        user = await upsertUserFromClerk({
          clerkId,
          email: 'dev-bypass@local.ironbid',
          firstName: 'Dev',
          lastName: 'User',
        })
      } else {
        const clerkUser = await currentUser()
        if (!clerkUser) {
          return NextResponse.json({ error: 'User profile unavailable' }, { status: 404 })
        }

        const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress
          || clerkUser.emailAddresses?.[0]?.emailAddress

        if (!primaryEmail) {
          return NextResponse.json({ error: 'User email unavailable' }, { status: 400 })
        }

        user = await upsertUserFromClerk({
          clerkId,
          email: primaryEmail,
          firstName: clerkUser.firstName ?? undefined,
          lastName: clerkUser.lastName ?? undefined,
          avatarUrl: clerkUser.imageUrl ?? undefined,
        })
      }
    }

    await db.update(schema.users)
      .set({ role, updatedAt: new Date() })
      .where(eq(schema.users.id, user.id))

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save role'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
