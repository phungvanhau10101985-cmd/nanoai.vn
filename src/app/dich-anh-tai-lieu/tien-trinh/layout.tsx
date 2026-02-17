import type { ReactNode } from 'react'
import { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Tiến trình dịch ảnh',
  description: 'Theo dõi tiến trình dịch ảnh tài liệu hàng loạt.',
  path: '/dich-anh-tai-lieu/tien-trinh',
  keywords: ['tiến trình dịch', 'dịch ảnh hàng loạt'],
  noIndex: true,
})

export default function TienTrinhLayout({ children }: { children: ReactNode }) {
  return children
}
