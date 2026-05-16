// app/api/onboarding/set-role/route.ts — Set user role during onboarding
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { z } from 'zod'
import { db, getUserByClerkId, upsertUserFromClerk } from '@/lib/db'
import { eq } from 'drizzle-orm'
import * as schema from '@/lib/schema'

export async function POST(req: NextRequest) {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = z.object({
    role: z.enum(['buyer','seller','dealer','carrier'])
  }).safeParse(await req.json())

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid role payload' }, { status: 400 })
  }

  const { role } = parsed.data

  let user = await getUserByClerkId(clerkId)

  if (!user) {
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

  await db.update(schema.users)
    .set({ role, updatedAt: new Date() })
    .where(eq(schema.users.id, user.id))

  return NextResponse.json({ ok: true })
}
