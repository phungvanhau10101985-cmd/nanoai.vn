import type { ReactNode } from 'react'
import { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Bảng điều khiển',
  description: 'Quản lý tài khoản, xem lịch sử và credits.',
  path: '/dashboard',
  noIndex: true,
})

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children
}
