import { redirect } from 'next/navigation'

type LegacySignUpPageProps = {
  params: { 'sign-up'?: string[] }
  searchParams?: { [key: string]: string | string[] | undefined }
}

export default function LegacySignUpPage({ params, searchParams }: LegacySignUpPageProps) {
  const tail = params?.['sign-up']?.length ? `/${params['sign-up'].join('/')}` : ''
  const query = new URLSearchParams()

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (Array.isArray(value)) {
        for (const v of value) query.append(key, v)
      } else if (typeof value === 'string') {
        query.set(key, value)
      }
    }
  }

  const qs = query.toString()
  redirect(`/auth/sign-up${tail}${qs ? `?${qs}` : ''}`)
}