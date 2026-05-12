// app/(auth)/sign-in/[[...sign-in]]/page.tsx — Clerk-hosted sign in
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="auth-logo">IRON<span>BID</span></div>
        <p className="auth-tagline">The industrial marketplace for heavy equipment</p>
      </div>
      <SignIn
        appearance={{
          elements: {
            rootBox:         'clerk-root',
            card:            'clerk-card',
            headerTitle:     'clerk-header',
            formButtonPrimary: 'clerk-btn-primary',
          },
          variables: {
            colorPrimary:    '#c94a1a',
            colorBackground: '#1a1a16',
            colorText:       '#f4f0e8',
            colorInputText:  '#f4f0e8',
            colorInputBackground: '#0a0a08',
            borderRadius:    '0px',
          },
        }}
      />
    </div>
  )
}
