import { redirect } from 'next/navigation'

type LegacySignInPageProps = {
  params: { 'sign-in'?: string[] }
  searchParams?: { [key: string]: string | string[] | undefined }
}

export default function LegacySignInPage({ params, searchParams }: LegacySignInPageProps) {
  const tail = params?.['sign-in']?.length ? `/${params['sign-in'].join('/')}` : ''
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
  redirect(`/auth/sign-in${tail}${qs ? `?${qs}` : ''}`)
}