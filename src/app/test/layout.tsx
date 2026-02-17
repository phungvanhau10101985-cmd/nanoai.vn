import type { ReactNode } from 'react'
import { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Trang test',
  description: 'Trang kiểm thử.',
  path: '/test',
  noIndex: true,
})

export default function TestLayout({ children }: { children: ReactNode }) {
  return children
}
