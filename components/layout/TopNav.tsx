// components/layout/TopNav.tsx — Shared top navigation bar
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import type { User } from '@/types'

interface Props {
  user: User
  portal?: 'dashboard' | 'carrier'
}

export function TopNav({ user, portal = 'dashboard' }: Props) {
  return (
    <nav className="topnav">
      <div className="tn-left">
        <Link href="/" className="logo">IRON<span>BID</span></Link>
        <div className="tn-sep" />
        <div className="portal-badge">
          <div className="pb-dot" />
          <span className="pb-text">
            {portal === 'carrier' ? 'Carrier Portal' : 'Seller Dashboard'}
          </span>
        </div>
      </div>

      <div className="tn-center">
        {portal === 'carrier' ? (
          <CarrierNav />
        ) : (
          <DashboardNav role={user.role} />
        )}
      </div>

      <div className="tn-right">
        <Link href="/auctions" className="tn-link">Browse Auctions</Link>
        <button className="notif-btn" aria-label="Notifications">🔔</button>
        <div className="user-chip">
          <UserButton afterSignOutUrl="/" />
          <span className="user-name">
            {user.companyName ?? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()}
          </span>
        </div>
      </div>
    </nav>
  )
}

function DashboardNav({ role }: { role: string }) {
  return (
    <div className="tn-nav-links">
      <Link href="/dashboard" className="tn-link">Overview</Link>
      <Link href="/dashboard/listings" className="tn-link">Listings</Link>
      <Link href="/dashboard/haul" className="tn-link">Haul Jobs</Link>
      <Link href="/dashboard/earnings" className="tn-link">Earnings</Link>
    </div>
  )
}

function CarrierNav() {
  return (
    <div className="tn-nav-links">
      <Link href="/carrier" className="tn-link">Overview</Link>
      <Link href="/carrier/my-bids" className="tn-link">My Bids</Link>
      <Link href="/carrier/active-loads" className="tn-link">Active Loads</Link>
      <Link href="/carrier/earnings" className="tn-link">Earnings</Link>
    </div>
  )
}
