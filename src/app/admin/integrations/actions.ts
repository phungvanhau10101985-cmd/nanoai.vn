'use server'

import { getUserForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import {
  loadAdminIntegrationsValueJsonByKey,
  upsertAdminIntegrationsValueJson,
} from '@/lib/db/admin-integrations-settings-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertStepUp, STEP_UP_REQUIRED } from '@/lib/auth/step-up-guard'
import { normalizeGoogleAdsConversionLabel } from '@/lib/partner-website/shop/normalize-ads-conversion-label'

const SETTINGS_KEY = 'admin_integrations_config'

type DomainVerificationTag = {
  name: string
  code: string
}

type IntegrationSettings = {
  googleAnalyticsId: string
  googleTagManagerId: string
  googleAdsId: string
  googleAdsViewLabel: string
  googleAdsAddToCartLabel: string
  googleAdsPurchaseLabel: string
  tiktokPixelId: string
  tiktokEventsApiToken: string
  facebookPixelId: string
  facebookCapiAccessToken: string
  facebookDatasetId: string
  facebookTestEventCode: string
  webConsoleVerificationTag: string
  domainVerificationTags: DomainVerificationTag[]
  chatEmbedCode: string
  /** Ghi song song để JSON cũ vẫn có khóa quen thuộc. */
  nanoaiEmbedCode: string
  facebookChatEmbedCode: string
  zaloChatEmbedCode: string
}

async function requireAdmin(): Promise<{ user: { id: string } } | { error: string }> {
  const authResult = await getUserForAction()
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult

  const role = await getProfileRoleWithFallback(user.id)
  if (role !== 'admin') {
    return { error: 'Permission denied. You must be an admin.' }
  }
  return { user }
}

function sanitizeSettings(input: Partial<IntegrationSettings>, fallbackEmbedCode: string): IntegrationSettings {
  const legacyGoogleTag = String((input as { googleTagId?: string })?.googleTagId || '').trim()
  const normalizedGa = String(input.googleAnalyticsId || '').trim()
  const normalizedGtm = String(input.googleTagManagerId || '').trim()
  const googleAnalyticsId = normalizedGa || (legacyGoogleTag.startsWith('G-') ? legacyGoogleTag : '')
  const googleTagManagerId = normalizedGtm || (legacyGoogleTag.startsWith('GTM-') ? legacyGoogleTag : '')
  const googleAdsRaw = String(input.googleAdsId || '').trim().toUpperCase()
  const googleAdsId = /^AW-[A-Z0-9]+$/.test(googleAdsRaw) ? googleAdsRaw : ''
  const googleAdsViewLabel = normalizeGoogleAdsConversionLabel(input.googleAdsViewLabel) || ''
  const googleAdsAddToCartLabel = normalizeGoogleAdsConversionLabel(input.googleAdsAddToCartLabel) || ''
  const googleAdsPurchaseLabel = normalizeGoogleAdsConversionLabel(input.googleAdsPurchaseLabel) || ''
  const tiktokRaw = String(input.tiktokPixelId || '').trim()
  const tiktokPixelId = /^[A-Z0-9]{10,64}$/i.test(tiktokRaw) ? tiktokRaw : ''
  const tiktokTokenRaw = String(input.tiktokEventsApiToken || '').trim()
  const tiktokEventsApiToken =
    tiktokTokenRaw.length >= 16 && tiktokTokenRaw.length <= 512 && /^[A-Za-z0-9._~+/-]+=*$/.test(tiktokTokenRaw)
      ? tiktokTokenRaw
      : ''
  const rawDomainTags = Array.isArray(input.domainVerificationTags) ? input.domainVerificationTags : []
  const domainVerificationTags = rawDomainTags
    .map((row) => ({
      name: String(row?.name || '').trim(),
      code: String(row?.code || '').trim(),
    }))
    .filter((row) => row.name || row.code)

  const embed =
    String(
      (input as { chatEmbedCode?: string }).chatEmbedCode || input.nanoaiEmbedCode || ''
    ).trim() || fallbackEmbedCode

  return {
    googleAnalyticsId,
    googleTagManagerId,
    googleAdsId,
    googleAdsViewLabel,
    googleAdsAddToCartLabel,
    googleAdsPurchaseLabel,
    tiktokPixelId,
    tiktokEventsApiToken,
    facebookPixelId: String(input.facebookPixelId || '').trim(),
    facebookCapiAccessToken: String(input.facebookCapiAccessToken || '').trim(),
    facebookDatasetId: String(input.facebookDatasetId || '').trim(),
    facebookTestEventCode: String(input.facebookTestEventCode || '').trim(),
    webConsoleVerificationTag: String(input.webConsoleVerificationTag || '').trim(),
    domainVerificationTags,
    chatEmbedCode: embed,
    nanoaiEmbedCode: embed,
    facebookChatEmbedCode: String(input.facebookChatEmbedCode || '').trim(),
    zaloChatEmbedCode: String(input.zaloChatEmbedCode || '').trim(),
  }
}

export async function loadAdminIntegrationsConfigAction(
  fallbackEmbedCode: string
): Promise<{ data: IntegrationSettings } | { error: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }

  if (!isPgConfigured()) {
    return { error: 'Cấu hình máy chủ thiếu DATABASE_URL.' }
  }

  const fromPg = await loadAdminIntegrationsValueJsonByKey(SETTINGS_KEY)
  let raw: Partial<IntegrationSettings> = {}
  if (fromPg != null && typeof fromPg === 'object' && !Array.isArray(fromPg)) {
    raw = fromPg as Partial<IntegrationSettings>
  }

  return { data: sanitizeSettings(raw, fallbackEmbedCode) }
}

export async function saveAdminIntegrationsConfigAction(
  input: Partial<IntegrationSettings>,
  fallbackEmbedCode: string
): Promise<{ ok: true } | { error: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }

  const step = await assertStepUp(gate.user.id, 'admin')
  if ('error' in step) return { error: STEP_UP_REQUIRED }

  const payload = sanitizeSettings(input, fallbackEmbedCode)

  if (!isPgConfigured()) {
    return { error: 'Cấu hình máy chủ thiếu DATABASE_URL.' }
  }

  const result = await upsertAdminIntegrationsValueJson(SETTINGS_KEY, payload, gate.user.id)
  if ('error' in result) return { error: result.error }
  revalidatePath('/admin/integrations')
  return { ok: true }
}
