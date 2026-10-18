import { Metadata } from 'next'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { FeatureCatalogPublicOffer } from '@/components/catalog/feature-catalog-public-offer'
import { getUserOrBypass } from '@/lib/auth'
import { isCatalogShopper } from '@/lib/catalog/catalog-shopper'
import { catalogPhotoCopy } from '@/lib/catalog-photo/catalog-photo-copy'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import { CatalogPhotoClient } from './catalog-photo-client'

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = getServerDictionary()
  const copy = catalogPhotoCopy(locale)
  return buildMetadata({
    title: copy.title,
    description: copy.description,
    path: '/tao-anh-ban-hang',
  })
}

/** Cùng các bước studio AI đăng sản phẩm, dừng ở bộ ảnh — không tạo sản phẩm trên shop. */
export default async function CatalogPhotoPage() {
  const user = await getUserOrBypass()
  if (!isCatalogShopper(user)) {
    return (
      <div className="app-shell">
        <FeatureCatalogPublicOffer path="/tao-anh-ban-hang" />
      </div>
    )
  }
  const { locale, t } = getServerDictionary()
  const copy = catalogPhotoCopy(locale)

  return (
    <div className="app-shell">
      <CreationToolPageShell currentHref="/tao-anh-ban-hang">
        <CatalogPhotoClient title={copy.title} t={t.partnerMessagingAi} exportUi={copy} />
      </CreationToolPageShell>
    </div>
  )
}
