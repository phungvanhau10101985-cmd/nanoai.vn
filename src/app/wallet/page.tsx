import WalletClient from './wallet-client'
import { Metadata } from 'next'
import { PublicCreditPrices } from '@/components/wallet/public-credit-prices'
import { getUserOrBypass } from '@/lib/auth'
import { isCatalogShopper } from '@/lib/catalog/catalog-shopper'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Nạp credit',
  description: 'Nạp credit để sử dụng toàn bộ tính năng AI của NanoAI. 1 credit = 6.000₫.',
  path: '/wallet',
  noIndex: true,
})

export default async function WalletPage() {
  const user = await getUserOrBypass()
  if (!isCatalogShopper(user)) {
    return (
      <div className="min-h-screen bg-[#F4F5FB] dark:bg-background">
        <PublicCreditPrices />
      </div>
    )
  }
  return <WalletClient />
}
