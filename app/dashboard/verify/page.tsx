import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getUserByClerkId } from '@/lib/db'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Verify Account | IRONBID' }
export const dynamic = 'force-dynamic'

export default async function DashboardVerifyPage() {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/auth/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/onboarding')

  if (user.role === 'carrier') redirect('/carrier')
  if (user.kycStatus === 'verified') redirect('/dashboard')

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Account <span>Verification</span></h1>
          <p className="page-sub">
            Submit your business and identity documents to unlock full seller privileges.
          </p>
        </div>
      </div>

      <section className="section-card" style={{ padding: '18px' }}>
        <div style={{ display: 'grid', gap: '10px' }}>
          <p style={{ color: 'var(--sand)', fontSize: '14px' }}>
            Verification status: <strong style={{ color: 'var(--amber)' }}>{user.kycStatus}</strong>
          </p>
          <p style={{ color: 'var(--fog)', fontSize: '13px' }}>
            Upload your government-issued ID and business documents to complete review.
            Once approved, your seller badge and payout capabilities will be fully enabled.
          </p>
        </div>

        <div style={{ marginTop: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link className="btn-primary" href="/dashboard/listings/new">
            Continue Listing
          </Link>
          <Link className="btn-ghost" href="/dashboard">
            Back to Dashboard
          </Link>
        </div>
      </section>
    </div>
  )
}
