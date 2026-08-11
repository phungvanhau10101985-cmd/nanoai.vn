import type { ReactNode } from 'react'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { Toaster } from '@/components/ui/toaster'
import { getUserOrBypass } from '@/lib/auth'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import { buildMetadata } from '@/lib/seo'
import { StepUpOtpProvider, StepUpStatusBanner } from '@/components/auth/step-up-otp-provider'
import { AdminShell } from '@/components/admin/admin-shell'
import { getCurrentWebLocale } from '@/lib/i18n/server'

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
  const locale = getCurrentWebLocale()

  return (
    <StepUpOtpProvider scope="admin">
      <div className="container max-w-screen-2xl py-6 space-y-4">
        <Toaster />
        <StepUpStatusBanner />
        <AdminShell locale={locale}>{children}</AdminShell>
      </div>
    </StepUpOtpProvider>
  )
}
