import LoginClient from './login-client'
import { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = buildMetadata({
  title: 'Đăng nhập',
  description: 'Đăng nhập để sử dụng các tính năng AI: thử đồ, phục dựng ảnh, làm nét ảnh, ghép ảnh.',
  path: '/auth/login',
  keywords: ['đăng nhập', 'NanoAI'],
  noIndex: true,
})

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { message?: string; error?: string; notice?: string; next?: string }
}) {
  const sessionUser = await getEmailSessionUser()
  if (sessionUser) {
    const safeNext = sanitizeLoginNext(searchParams?.next)
    redirect(safeNext)
  }

  const emailAuthEnabled =
    process.env.EMAIL_AUTH_ENABLED === '1' || process.env.EMAIL_AUTH_ENABLED === 'true'
  return (
    <LoginClient
      message={searchParams?.message}
      notice={searchParams?.notice}
      error={searchParams?.error}
      nextPath={searchParams?.next}
      emailAuthEnabled={emailAuthEnabled}
    />
  )
}
