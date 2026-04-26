import type { ReactNode } from 'react'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import Link from 'next/link'
import { Toaster } from '@/components/ui/toaster'
import { getUserOrBypass } from '@/lib/auth'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import { buildMetadata } from '@/lib/seo'
import { ChevronLeft } from 'lucide-react'

export const metadata: Metadata = buildMetadata({
  title: 'Quản trị',
  description: 'Quản trị hệ thống NanoAI.',
  path: '/admin',
  noIndex: true,
})

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  const role = await getProfileRoleWithFallback(user.id)
  if (role !== 'admin') redirect('/')
  return (
    <div className="container max-w-screen-2xl py-6 space-y-6">
      <Toaster />
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Quản trị
      </Link>
      {children}
    </div>
  )
}
