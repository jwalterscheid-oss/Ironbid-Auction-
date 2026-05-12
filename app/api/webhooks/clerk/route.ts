// app/api/webhooks/clerk/route.ts — Sync Clerk users to Supabase
import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { upsertUserFromClerk } from '@/lib/db'
import { notifyNewUserRegistered, notifyError } from '@/lib/slack'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // Verify Svix signature
  const headers = {
    'svix-id':        req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  }

  const rawBody = await req.text()

  let event: any
  try {
    const wh = new Webhook(webhookSecret)
    event = wh.verify(rawBody, headers)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        const { id, email_addresses, first_name, last_name, image_url } = event.data
        const email = email_addresses?.[0]?.email_address

        if (!email) break

        const user = await upsertUserFromClerk({
          clerkId:   id,
          email,
          firstName: first_name ?? undefined,
          lastName:  last_name ?? undefined,
          avatarUrl: image_url ?? undefined,
        })

        if (event.type === 'user.created') {
          await notifyNewUserRegistered({
            name:  `${first_name ?? ''} ${last_name ?? ''}`.trim(),
            email,
            role:  'buyer',
          }).catch(() => {})
        }
        break
      }

      case 'user.deleted': {
        const { id } = event.data
        await supabaseAdmin
          .from('users')
          .update({ role: 'buyer', kycStatus: 'rejected' })  // soft delete
          .eq('clerk_id', id)
        break
      }
    }
  } catch (err: any) {
    await notifyError({
      context:  `Clerk webhook: ${event.type}`,
      error:    err.message,
      severity: 'high',
    }).catch(() => {})
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
