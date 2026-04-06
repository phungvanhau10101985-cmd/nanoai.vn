import { createClient } from '@/lib/supabase/server'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
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

export default async function DashboardApiIntegrationPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirectToLogin()

  const h = headers()
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0]?.trim()
  const protoFromProxy = (h.get('x-forwarded-proto') ?? '').split(',')[0]?.trim()
  const proto = protoFromProxy || (host && /localhost|127\.0\.0\.1/i.test(host) ? 'http' : 'https')
  const runtimeBaseUrl = host ? `${proto}://${host}` : ''
  const baseUrl = runtimeBaseUrl || resolveApiKeysHubBaseUrl()

  const { data: partnerRows } = await supabase
    .from('messaging_partners')
    .select('id, display_name, slug')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="app-shell container max-w-5xl py-6">
      <ApiKeysHub variant="partner" baseUrl={baseUrl} partnerWorkspaces={partnerRows ?? []} />
    </div>
  )
}
