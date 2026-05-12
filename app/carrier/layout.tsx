// app/carrier/layout.tsx — Carrier portal shell
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getUserByClerkId, getCarrierProfile } from '@/lib/db'
import { CarrierSidebar } from '@/components/carrier/CarrierSidebar'
import { TopNav } from '@/components/layout/TopNav'

export default async function CarrierLayout({ children }: { children: React.ReactNode }) {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/sign-in')

  const user = await getUserByClerkId(clerkId)
  if (!user) redirect('/onboarding')
  if (user.role !== 'carrier') redirect('/dashboard')

  const profile = await getCarrierProfile(user.id)
  if (!profile) redirect('/carrier/register')

  return (
    <div className="carrier-shell">
      <TopNav user={user} portal="carrier" />
      <div className="carrier-body">
        <CarrierSidebar profile={profile} />
        <main className="carrier-main">{children}</main>
      </div>
    </div>
  )
}
