import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getUserByClerkId } from '@/lib/db'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Verify Account | IRONBID' }
export const dynamic = 'force-dynamic'

export default async function DashboardVerifyPage({
  searchParams,
}: {
  searchParams: { status?: string; error?: string }
}) {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/auth/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/onboarding')

  if (user.role === 'carrier') redirect('/carrier')
  if (user.kycStatus === 'verified') redirect('/dashboard')

  const justSubmitted = searchParams.status === 'submitted'
  const startError = searchParams.error

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Account <span>Verification</span></h1>
          <p className="page-sub">
            Verify your identity to unlock bidding and full seller privileges.
          </p>
        </div>
      </div>

      <section className="section-card" style={{ padding: '18px' }}>
        <div style={{ display: 'grid', gap: '10px' }}>
          <p style={{ color: 'var(--sand)', fontSize: '14px' }}>
            Verification status: <strong style={{ color: 'var(--amber)' }}>{user.kycStatus}</strong>
          </p>

          {justSubmitted ? (
            <p style={{ color: 'var(--fog)', fontSize: '13px' }}>
              Your documents were submitted to Stripe Identity. Verification usually
              completes within a few minutes — this page will update once it&apos;s reviewed.
              You can safely leave and check back later.
            </p>
          ) : (
            <p style={{ color: 'var(--fog)', fontSize: '13px' }}>
              We use Stripe Identity to confirm your identity. You&apos;ll be asked to
              photograph a government-issued ID and take a selfie. Once approved, your
              bidding and payout capabilities are enabled automatically.
            </p>
          )}

          {startError && (
            <p style={{ color: 'var(--rust, #c0392b)', fontSize: '13px' }}>
              Could not start verification: {startError}. Please try again, or contact
              support if the problem continues.
            </p>
          )}
        </div>

        <div style={{ marginTop: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <a className="btn-primary" href="/api/verify/start">
            {justSubmitted ? 'Restart Verification' : 'Start Identity Verification'}
          </a>
          <Link className="btn-ghost" href="/dashboard">
            Back to Dashboard
          </Link>
        </div>
      </section>
    </div>
  )
}
