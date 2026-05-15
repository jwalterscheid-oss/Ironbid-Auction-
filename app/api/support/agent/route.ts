import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { notifyError } from '@/lib/slack'

const SupportRequestSchema = z.object({
  message: z.string().min(1).max(4000),
})

function fallbackSupportReply(message: string) {
  const text = message.toLowerCase()

  if (text.includes('sign in') || text.includes('login') || text.includes('password')) {
    return 'Sign-in issues are usually resolved by clearing browser cookies for this site and retrying. If you still cannot access your account, use the Sign In page and follow the reset flow, then contact support with your account email.'
  }

  if (text.includes('bid') || text.includes('auction')) {
    return 'For bidding issues, verify the auction is active, your bid amount exceeds the current minimum increment, and your account verification is complete. If a bid fails, share the lot number and timestamp with support so we can review the logs.'
  }

  if (text.includes('payment') || text.includes('stripe') || text.includes('charge')) {
    return 'For payment issues, confirm your payment method is valid and your billing details match bank records. If a payment appears stuck, provide the lot number and transaction ID so support can trace the Stripe event and payment state.'
  }

  if (text.includes('haul') || text.includes('carrier') || text.includes('delivery')) {
    return 'For haul issues, verify job status, bid window timing, and carrier award state. If delivery confirmation is blocked, include the haul job ID and current status so support can investigate the transition rules.'
  }

  return 'I can help with sign-in, bidding, auctions, payments, and haul logistics. Share the exact issue, lot/job ID, and what happened vs expected behavior, and I will guide you step by step.'
}

export async function POST(req: Request) {
  const parsed = SupportRequestSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { message } = parsed.data
  const apiKey = process.env.ANTHROPIC_API_KEY
  const model = process.env.SUPPORT_AGENT_MODEL ?? 'claude-3-5-sonnet-latest'

  if (!apiKey) {
    return NextResponse.json({
      reply: fallbackSupportReply(message),
      provider: 'fallback',
    })
  }

  try {
    const anthropic = new Anthropic({ apiKey })
    const completion = await anthropic.messages.create({
      model,
      max_tokens: 500,
      temperature: 0.2,
      system: [
        'You are the IRONBID customer support assistant.',
        'Help users troubleshoot issues with authentication, auctions, bidding, payments, and haul jobs.',
        'Be concise, accurate, and practical. Ask for IDs (lot number, auction ID, haul job ID, transaction ID) when needed.',
        'Do not invent system capabilities. If uncertain, state uncertainty and recommend escalation to human support.',
      ].join(' '),
      messages: [{ role: 'user', content: message }],
    })

    const reply = completion.content
      .filter((item) => item.type === 'text')
      .map((item) => item.text)
      .join('\n')
      .trim()

    return NextResponse.json({
      reply: reply || fallbackSupportReply(message),
      provider: 'claude',
      model,
    })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Claude support request failed'
    await notifyError({
      context: 'Claude support agent',
      error: errorMessage,
      severity: 'medium',
      data: { model },
    })

    return NextResponse.json({
      reply: fallbackSupportReply(message),
      provider: 'fallback',
    })
  }
}
