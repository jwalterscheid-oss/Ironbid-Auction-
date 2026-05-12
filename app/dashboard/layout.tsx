// app/dashboard/layout.tsx — Dashboard shell with sidebar
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getUserByClerkId } from '@/lib/db'
import { DashboardSidebar } from '@/components/layout/DashboardSidebar'
import { TopNav } from '@/components/layout/TopNav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/sign-in')

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
