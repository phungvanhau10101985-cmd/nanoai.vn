import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { isValidUuidString } from '@/lib/validate-uuid'
import { fetchMessagingPartnersByOwnerFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { getHospitalityDashboardDictionary } from '@/lib/i18n/hospitality-dashboard'
import { HospitalityDashboardClient, type HospitalityPartnerCard } from './hospitality-dashboard-client'

export const dynamic = 'force-dynamic'

export default async function DashboardHospitalityPage() {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  if (!isValidUuidString(user.id)) redirectToLogin()

  const locale = getCurrentWebLocale()
  const t = getHospitalityDashboardDictionary(locale)

  const allPartners = isPgConfigured() ? ((await fetchMessagingPartnersByOwnerFromPg(user.id)) ?? []) : []
  const hospitalityPartners: HospitalityPartnerCard[] = allPartners
    .filter((p) => p.industry_key === 'hotel')
    .map((p) => ({
      id: p.id,
      display_name: p.display_name,
      slug: p.slug,
      brand_name: p.brand_name ?? null,
      logo_url: p.logo_url ?? null,
      is_active: p.is_active !== false,
      purge_at: p.purge_at ?? null,
      created_at: p.created_at ?? null,
    }))

  return (
    <div className="app-shell flex min-h-[calc(100dvh-5rem)] flex-col space-y-6 md:space-y-8">
      <div className="section-surface space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
              <Building2 className="h-7 w-7 shrink-0 text-violet-600" aria-hidden />
              {t.pageTitle}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{t.pageDescription}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hospitalityPartners.length > 0 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/hospitality/settings">{t.settingsLink}</Link>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/messaging">{t.backToMessaging}</Link>
            </Button>
          </div>
        </div>
      </div>
      <HospitalityDashboardClient partners={hospitalityPartners} locale={locale} />
    </div>
  )
}
