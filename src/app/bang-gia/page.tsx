import type { Metadata } from 'next'
import { PublicCreditPrices } from '@/components/wallet/public-credit-prices'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Bảng giá credit',
  description:
    '1 credit = 6.000₫. Tin chat đầu miễn phí, thử đồ 1 người 1 credit, ảnh 2K 1,5 credit, ảnh 4K 3 credit.',
  path: '/bang-gia',
  keywords: ['bảng giá NanoAI', 'credit', 'nạp credit', 'thử đồ', 'giá ảnh AI'],
})

export default function BangGiaPage() {
  return (
    <div className="min-h-screen bg-[#F4F5FB] dark:bg-background">
      <PublicCreditPrices />
    </div>
  )
}

