// app/api/onboarding/set-role/route.ts — Set user role during onboarding
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { db, getUserByClerkId } from '@/lib/db'
import { eq } from 'drizzle-orm'
import * as schema from '@/lib/schema'

export async function POST(req: NextRequest) {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role } = z.object({
    role: z.enum(['buyer','seller','dealer','carrier'])
  }).parse(await req.json())

  const user = await getUserByClerkId(clerkId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await db.update(schema.users)
    .set({ role, updatedAt: new Date() })
    .where(eq(schema.users.id, user.id))

  return NextResponse.json({ ok: true })
}
