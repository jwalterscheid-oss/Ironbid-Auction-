// components/layout/DashboardSidebar.tsx — Seller dashboard sidebar
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { KycStatus, UserRole } from '@/types'

interface Props { role: UserRole; kycStatus: KycStatus }

const NAV = [
  { label: 'Main', items: [
    { href: '/dashboard',           icon: '📊', label: 'Overview' },
    { href: '/dashboard/listings',  icon: '📋', label: 'My Listings' },
    { href: '/dashboard/haul',      icon: '🚛', label: 'Haul Jobs' },
    { href: '/dashboard/watchlist', icon: '♡',  label: 'Watchlist' },
  ]},
  { label: 'Finance', items: [
    { href: '/dashboard/earnings',  icon: '💰', label: 'Earnings' },
    { href: '/dashboard/invoices',  icon: '🧾', label: 'Invoices' },
    { href: '/dashboard/payouts',   icon: '🏦', label: 'Payouts' },
  ]},
  { label: 'Account', items: [
    { href: '/dashboard/messages',  icon: '💬', label: 'Messages' },
    { href: '/dashboard/documents', icon: '📁', label: 'Documents' },
    { href: '/dashboard/settings',  icon: '⚙️', label: 'Settings' },
  ]},
]

export function DashboardSidebar({ role, kycStatus }: Props) {
  void role
  const path = usePathname()
  return (
    <aside className="sidebar">
      {NAV.map(section => (
        <div key={section.label} className="sb-section">
          <div className="sb-label">{section.label}</div>
          {section.items.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`sb-item ${path === item.href || path.startsWith(item.href + '/') ? 'active' : ''}`}
            >
              <span className="sb-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      ))}

      {kycStatus !== 'verified' && (
        <div className="sidebar-kyc-warn">
          <Link href="/dashboard/verify" className="kyc-link">
            ⚠ Complete Verification
          </Link>
        </div>
      )}
    </aside>
  )
}
