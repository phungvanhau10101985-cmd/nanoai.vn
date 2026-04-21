import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Building2, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { isValidUuidString } from '@/lib/validate-uuid'
import { fetchMessagingPartnerByIdFromPg, fetchMessagingPartnersByOwnerFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { getHospitalitySettingsDictionary } from '@/lib/i18n/hospitality-settings'
import { getPublicOriginFromAppRouterHeaders } from '@/lib/auth/public-app-url'
import { HospitalitySettingsClient } from './hospitality-settings-client'

export const dynamic = 'force-dynamic'

export default async function DashboardHospitalitySettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  if (!isValidUuidString(user.id)) redirectToLogin()
  const locale = getCurrentWebLocale()
  const t = getHospitalitySettingsDictionary(locale)
  const appOrigin = getPublicOriginFromAppRouterHeaders(headers())

  const sp = searchParams ? await searchParams : {}
  const partnerParamRaw = sp?.partner
  const partnerParam = Array.isArray(partnerParamRaw) ? partnerParamRaw[0] : partnerParamRaw
  const partnerFromUrl = partnerParam && isValidUuidString(String(partnerParam).trim())
    ? String(partnerParam).trim()
    : ''

  // Fashion partners hitting this hospitality-only settings page must bounce
  // back — keeps the two verticals' settings surfaces strictly independent.
  if (partnerFromUrl && isPgConfigured()) {
    const info = await fetchMessagingPartnerByIdFromPg(partnerFromUrl)
    if (info && info.industry_key !== 'hotel') {
      redirect(`/dashboard/messaging/settings?partner=${encodeURIComponent(partnerFromUrl)}`)
    }
  }

  const allPartners = isPgConfigured() ? ((await fetchMessagingPartnersByOwnerFromPg(user.id)) ?? []) : []
  const hospitalityPartners = allPartners
    .filter((p) => p.industry_key === 'hotel')
    .map((p) => ({ id: p.id, display_name: p.display_name, slug: p.slug }))

  const initialPartnerId = partnerFromUrl && hospitalityPartners.some((p) => p.id === partnerFromUrl)
    ? partnerFromUrl
    : hospitalityPartners[0]?.id ?? ''

  return (
    <div className="app-shell flex min-h-[calc(100dvh-5rem)] flex-col space-y-6 md:space-y-8">
      <div className="section-surface space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
              <Settings className="h-7 w-7 shrink-0 text-violet-600" aria-hidden />
              {t.pageTitle}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t.pageDescription}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/hospitality">
                <Building2 className="mr-2 h-4 w-4" /> {t.overview}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">{t.dashboard}</Link>
            </Button>
          </div>
        </div>
      </div>

      {hospitalityPartners.length === 0 ? (
        <div className="section-surface">
          <p className="text-sm text-muted-foreground">
            {t.noWorkspace}{' '}
            <Link href="/dashboard/messaging/settings" className="text-violet-600 underline">
              {t.createWorkspace}
            </Link>{' '}
            rồi đặt ngành nghề «Khách sạn».
          </p>
        </div>
      ) : (
        <HospitalitySettingsClient
          partners={hospitalityPartners}
          initialPartnerId={initialPartnerId}
          t={t}
          appOrigin={appOrigin}
        />
      )}
    </div>
  )
}
