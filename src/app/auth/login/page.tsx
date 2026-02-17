import LoginClient from './login-client'
import { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Đăng nhập',
  description: 'Đăng nhập để sử dụng các tính năng AI: thử đồ, phục dựng ảnh, làm nét ảnh, ghép ảnh.',
  path: '/auth/login',
  keywords: ['đăng nhập', 'NanoAI'],
  noIndex: true,
})

export default function LoginPage({
  searchParams,
}: {
  searchParams: { message: string; error: string }
}) {
  return (
    <LoginClient message={searchParams?.message} error={searchParams?.error} />
  )
}
