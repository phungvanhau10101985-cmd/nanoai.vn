import WalletClient from './wallet-client'
import { Metadata } from 'next'
import { FeatureCatalogPublicOffer } from '@/components/catalog/feature-catalog-public-offer'
import { getUserOrBypass } from '@/lib/auth'
import { isCatalogShopper } from '@/lib/catalog/catalog-shopper'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Nạp credit',
  description: 'Nạp credit để sử dụng toàn bộ tính năng AI của NanoAI.',
  path: '/wallet',
})

export default async function WalletPage() {
  const user = await getUserOrBypass()
  if (!isCatalogShopper(user)) {
    return (
      <div className="app-shell">
        <FeatureCatalogPublicOffer path="/wallet" />
      </div>
    )
  }
  return <WalletClient />
}
