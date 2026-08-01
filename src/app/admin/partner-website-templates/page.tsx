import { PartnerWebsiteTemplatesAdminClient } from './partner-website-templates-admin-client'
import { getCurrentWebLocale } from '@/lib/i18n/server'

export default async function PartnerWebsiteTemplatesAdminPage() {
  const locale = await getCurrentWebLocale()
  return <PartnerWebsiteTemplatesAdminClient locale={locale} />
}
