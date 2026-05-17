// app/carrier/register/page.tsx — Carrier registration entry (server wrapper)
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { CarrierRegisterForm } from '@/components/carrier/CarrierRegisterForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Carrier Registration | IRONBID' }
export const dynamic = 'force-dynamic'

export default function CarrierRegisterPage() {
  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/auth/sign-in')

  return <CarrierRegisterForm />
}
