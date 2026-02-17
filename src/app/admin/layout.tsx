import type { ReactNode } from 'react'
import { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Quản trị',
  description: 'Quản trị hệ thống NanoAI.',
  path: '/admin',
  noIndex: true,
})

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children
}
