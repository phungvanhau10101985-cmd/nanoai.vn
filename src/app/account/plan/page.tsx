import { FeatureCatalogPublicOffer } from '@/components/catalog/feature-catalog-public-offer'
import { getUserOrBypass } from '@/lib/auth'
import { isCatalogShopper } from '@/lib/catalog/catalog-shopper'
import { getServerDictionary, getCurrentWebLocale } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import { AccountPlanClientPage } from './account-plan-client'
import type { WebLocale } from '@/lib/i18n/config'

const OG_LOCALE: Record<WebLocale, string> = {
  vi: 'vi_VN',
  en: 'en_US',
  zh: 'zh_CN',
  ja: 'ja_JP',
  ko: 'ko_KR',
}

export async function generateMetadata() {
  const locale = getCurrentWebLocale()
  const { t } = await getServerDictionary()
  const path = '/account/plan'
  return buildMetadata({
    title: t.accountPlan.pageTitle,
    description: t.accountPlan.metaDescription,
    path,
    keywords: ['NanoAI', 'giáo trình', 'curriculum', 'trial', 'credits', 'gói giáo trình'],
    locale: OG_LOCALE[locale] ?? 'vi_VN',
    noIndex: false,
  })
}

export default async function AccountPlanPage() {
  const user = await getUserOrBypass()
  if (!isCatalogShopper(user)) {
    const { t } = getServerDictionary()
    return (
      <div className="app-shell">
        <FeatureCatalogPublicOffer path="/account/plan" overview={t.featureCatalogOffer.note} />
      </div>
    )
  }

  const { t } = await getServerDictionary()
  const locale = getCurrentWebLocale()

  return <AccountPlanClientPage t={t.accountPlan} webLocale={locale} />
}
