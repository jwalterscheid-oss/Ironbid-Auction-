// app/(auth)/layout.tsx — Clean layout for auth pages
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-layout">
      {children}
    </div>
  )
}
