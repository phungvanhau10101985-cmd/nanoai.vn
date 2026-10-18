import { redirect } from 'next/navigation'
import { FeatureCatalogPublicOffer } from '@/components/catalog/feature-catalog-public-offer'
import { getUserOrBypass } from '@/lib/auth'
import { isCatalogShopper } from '@/lib/catalog/catalog-shopper'
import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: 'Thử đồ Online',
  description: 'Thử đồ ảo với AI trên NanoAI.',
  path: '/thu-do-online',
  keywords: ['thử đồ', 'thử đồ ảo', 'AI thử đồ'],
})

export default async function TryOnPage() {
  const user = await getUserOrBypass()
  if (!isCatalogShopper(user)) {
    return (
      <div className="app-shell">
        <FeatureCatalogPublicOffer path="/thu-do-online" />
      </div>
    )
  }
  redirect('/thu-do-online/1-nguoi')
}
