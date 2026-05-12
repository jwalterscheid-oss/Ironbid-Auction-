// components/carrier/CarrierSidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { CarrierProfile } from '@/types'

export function CarrierSidebar({ profile }: { profile: CarrierProfile }) {
  const path = usePathname()
  const nav = [
    { href: '/carrier',              icon: '📊', label: 'Overview' },
    { href: '/carrier/jobs',         icon: '🗂️', label: 'Available Jobs' },
    { href: '/carrier/my-bids',      icon: '⚡', label: 'My Bids' },
    { href: '/carrier/active-loads', icon: '🚛', label: 'Active Loads' },
    { href: '/carrier/completed',    icon: '✅', label: 'Completed' },
    { href: '/carrier/earnings',     icon: '💰', label: 'Earnings' },
    { href: '/carrier/payouts',      icon: '🏦', label: 'Payouts' },
    { href: '/carrier/profile',      icon: '🏢', label: 'Company Profile' },
    { href: '/carrier/fleet',        icon: '🔧', label: 'Fleet & Equipment' },
    { href: '/carrier/reviews',      icon: '⭐', label: 'Reviews' },
  ]
  return (
    <aside className="sidebar">
      {nav.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={`sb-item ${path === item.href ? 'active' : ''}`}
        >
          <span className="sb-icon">{item.icon}</span>
          {item.label}
        </Link>
      ))}
      <div className="sb-rating">
        <div className="sb-rating-label">Your Rating</div>
        <div className="sb-stars">{'★'.repeat(Math.round(Number(profile.avgRating)))}{'☆'.repeat(5 - Math.round(Number(profile.avgRating)))}</div>
        <div className="sb-rating-val">{Number(profile.avgRating).toFixed(1)} · {profile.completedHauls} hauls</div>
      </div>
    </aside>
  )
}
