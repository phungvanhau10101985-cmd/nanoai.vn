import { Suspense } from 'react'
import { headers } from 'next/headers'
import { fetchMessagingPartnersByOwnerFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { isValidUuidString } from '@/lib/validate-uuid'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { PartnerSiteLoginGuide } from '@/components/integration/partner-site-login-guide'
import { pickApiKeysHubLocale } from '@/lib/integration/api-keys-hub-locale-server'
import { resolveApiKeysHubBaseUrl } from '@/lib/integration/api-keys-hub-copy'

export function generateMetadata(): Metadata {
  const { t } = getServerDictionary()
  return buildMetadata({
    title: t.partnerMessaging.partnerSiteLoginGuideLink,
    description: t.partnerMessaging.partnerSiteLoginGuideShort,
    path: '/dashboard/messaging/partner-site-login',
    noIndex: true,
  })
}

function PartnerSiteLoginGuideFallback() {
  return <div className="min-h-[12rem] animate-pulse rounded-xl border bg-muted/30" />
}

export default async function PartnerSiteLoginGuidePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  if (!isValidUuidString(user.id)) redirectToLogin()

  let partnerRows: {
    id: string
    display_name: string
    slug: string
    logo_url: string | null
    embed_key: string
  }[] = []
  if (isPgConfigured()) {
    const fromPg = await fetchMessagingPartnersByOwnerFromPg(user.id)
    if (fromPg !== null) {
      partnerRows = fromPg.map((p) => ({
        id: p.id,
        display_name: p.display_name,
        slug: p.slug,
        logo_url: p.logo_url ?? null,
        embed_key: (p.embed_key ?? '').trim(),
      }))
    }
  }

  const rawPartner = searchParams?.partner
  const partnerParam = Array.isArray(rawPartner) ? rawPartner[0] : rawPartner
  const partnerQuery = typeof partnerParam === 'string' ? partnerParam.trim() : ''
  const initialSelectedPartnerId =
    partnerQuery && partnerRows.some((p) => p.id === partnerQuery) ? partnerQuery : null

  const h = headers()
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0]?.trim()
  const protoFromProxy = (h.get('x-forwarded-proto') ?? '').split(',')[0]?.trim()
  const proto = protoFromProxy || (host && /localhost|127\.0\.0\.1/i.test(host) ? 'http' : 'https')
  const runtimeBaseUrl = host ? `${proto}://${host}` : ''
  const baseUrl = runtimeBaseUrl || resolveApiKeysHubBaseUrl()
  const locale = pickApiKeysHubLocale()

  return (
    <div className="app-shell container max-w-4xl py-6">
      <Suspense fallback={<PartnerSiteLoginGuideFallback />}>
        <PartnerSiteLoginGuide
          baseUrl={baseUrl}
          locale={locale}
          partners={partnerRows}
          initialSelectedPartnerId={initialSelectedPartnerId}
        />
      </Suspense>
    </div>
  )
}
