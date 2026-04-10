import { fetchMessagingPartnersByOwnerFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { isValidUuidString } from '@/lib/validate-uuid'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { ApiKeysHub } from '@/components/integration/api-keys-hub'
import { resolveApiKeysHubBaseUrl } from '@/lib/integration/api-keys-hub-copy'

export function generateMetadata(): Metadata {
  const { t } = getServerDictionary()
  const title = t.partnerMessaging.apiIntegrationGuideLink
  const description = t.partnerMessaging.apiIntegrationGuideShort
  return buildMetadata({
    title,
    description,
    path: '/dashboard/api-integration',
    noIndex: true,
  })
}

export default async function DashboardApiIntegrationPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  if (!isValidUuidString(user.id)) redirectToLogin()

  let partnerRows: { id: string; display_name: string; slug: string }[] = []
  if (isPgConfigured()) {
    const fromPg = await fetchMessagingPartnersByOwnerFromPg(user.id)
    if (fromPg !== null) {
      partnerRows = fromPg.map((p) => ({ id: p.id, display_name: p.display_name, slug: p.slug }))
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

  return (
    <div className="app-shell container max-w-5xl py-6">
      <ApiKeysHub
        variant="partner"
        baseUrl={baseUrl}
        partnerWorkspaces={partnerRows ?? []}
        initialSelectedPartnerId={initialSelectedPartnerId}
      />
    </div>
  )
}
