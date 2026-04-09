import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'

export default async function DichAnhTaiLieuLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()

  return (
    <div className="app-shell">
      {children}
    </div>
  )
}
