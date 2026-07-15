import type { ReactNode } from 'react'
import { Metadata } from 'next'
import { Toaster } from '@/components/ui/toaster'
import { buildMetadata } from '@/lib/seo'
import { StepUpOtpProvider, StepUpStatusBanner } from '@/components/auth/step-up-otp-provider'

export const metadata: Metadata = buildMetadata({
  title: 'Bảng điều khiển',
  description: 'Quản lý tài khoản, xem lịch sử và credits.',
  path: '/dashboard',
  noIndex: true,
})

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <StepUpOtpProvider scope="account">
      <div className="container max-w-screen-2xl space-y-4 py-4">
        <StepUpStatusBanner />
        {children}
      </div>
      <Toaster />
    </StepUpOtpProvider>
  )
}
