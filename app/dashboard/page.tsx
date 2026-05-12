// app/dashboard/page.tsx — Seller dashboard overview (Server Component)
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getUserByClerkId, getListingsBySeller, getUserBids } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs'
import { ActiveListingsTable } from '@/components/dashboard/ActiveListingsTable'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard | IRONBID' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/onboarding')

  // Fetch seller data
  const [listings, transactions] = await Promise.all([
    getListingsBySeller(user.id),
    supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(r => r.data ?? []),
  ])

  // KPI calculations
  const ytdRevenue    = transactions.filter(t => t.payment_status === 'paid').reduce((s, t) => s + Number(t.seller_proceeds ?? 0), 0)
  const activeCount   = listings.filter(l => l.status === 'active').length
  const soldCount     = listings.filter(l => l.status === 'sold').length
  const avgSellPrice  = soldCount > 0 ? ytdRevenue / soldCount : 0

  return (
    <div className="dashboard-page">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Seller <span>Dashboard</span></h1>
          <p className="page-sub">
            {user.companyName ?? `${user.firstName} ${user.lastName}`}
            {user.isVerifiedDealer && ' · Verified Dealer'}
            {' · '}Last updated: just now
          </p>
        </div>
        <Link href="/dashboard/listings/new" className="btn-primary">
          + NEW LISTING
        </Link>
      </div>

      {/* KPIs */}
      <DashboardKPIs
        ytdRevenue={ytdRevenue}
        activeListings={activeCount}
        soldItems={soldCount}
        avgSellPrice={avgSellPrice}
      />

      {/* Two-column layout */}
      <div className="dashboard-grid">
        {/* Active listings table */}
        <ActiveListingsTable listings={listings as any} />

        {/* Recent activity feed */}
        <RecentActivity
          userId={user.id}
          transactions={transactions as any}
        />
      </div>

      {/* KYC warning banner */}
      {user.kycStatus === 'pending' && (
        <div className="kyc-banner">
          <span>⚠ Your identity verification is pending.</span>
          <Link href="/dashboard/verify">Complete Verification →</Link>
        </div>
      )}
    </div>
  )
}
