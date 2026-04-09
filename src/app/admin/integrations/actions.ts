'use server'

import { getUserForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import {
  loadAdminIntegrationsValueJsonByKey,
  upsertAdminIntegrationsValueJson,
} from '@/lib/db/admin-integrations-settings-pg'
import { isPgConfigured } from '@/lib/db/pool'

const SETTINGS_KEY = 'admin_integrations_config'

type DomainVerificationTag = {
  name: string
  code: string
}

type IntegrationSettings = {
  googleAnalyticsId: string
  googleTagManagerId: string
  facebookPixelId: string
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
    facebookPixelId: String(input.facebookPixelId || '').trim(),
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

  const payload = sanitizeSettings(input, fallbackEmbedCode)

  if (!isPgConfigured()) {
    return { error: 'Cấu hình máy chủ thiếu DATABASE_URL.' }
  }

  const result = await upsertAdminIntegrationsValueJson(SETTINGS_KEY, payload, gate.user.id)
  if ('error' in result) return { error: result.error }
  revalidatePath('/admin/integrations')
  return { ok: true }
}
