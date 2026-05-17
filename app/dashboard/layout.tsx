// app/dashboard/layout.tsx — Dashboard shell with sidebar
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getUserByClerkId } from '@/lib/db'
import { DashboardSidebar } from '@/components/layout/DashboardSidebar'
import { TopNav } from '@/components/layout/TopNav'
import type { KycStatus, UserRole } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (process.env.DEV_AUTH_BYPASS === 'true') {
    const mockUser = {
      companyName: 'Demo Equipment Co.',
      firstName: 'Test',
      lastName: 'Seller',
      role: 'seller' as UserRole,
      kycStatus: 'verified' as KycStatus,
    }

    return (
      <div className="dashboard-shell">
        <TopNav user={mockUser} />
        <div className="dashboard-body">
          <DashboardSidebar role={mockUser.role} kycStatus={mockUser.kycStatus} />
          <main className="dashboard-main">{children}</main>
        </div>
      </div>
    )
  }

  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/auth/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/onboarding')

  // Redirect carriers to their own portal
  if (user.role === 'carrier') redirect('/carrier')

  return (
    <div className="dashboard-shell">
      <TopNav user={user} />
      <div className="dashboard-body">
        <DashboardSidebar role={user.role} kycStatus={user.kycStatus} />
        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  )
}
