'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const SETTINGS_KEY = 'admin_integrations_config'
const SETTINGS_TABLE = 'admin_integrations_settings'

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
  nanoaiEmbedCode: string
  facebookChatEmbedCode: string
  zaloChatEmbedCode: string
}

function adminServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, { auth: { persistSession: false } })
}

async function requireAdmin(): Promise<{ user: { id: string } } | { error: string }> {
  const supabase = createClient()
  const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in authResult) return { error: authResult.error }
  const { user } = authResult
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
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

  return {
    googleAnalyticsId,
    googleTagManagerId,
    facebookPixelId: String(input.facebookPixelId || '').trim(),
    webConsoleVerificationTag: String(input.webConsoleVerificationTag || '').trim(),
    domainVerificationTags,
    nanoaiEmbedCode: String(input.nanoaiEmbedCode || '').trim() || fallbackEmbedCode,
    facebookChatEmbedCode: String(input.facebookChatEmbedCode || '').trim(),
    zaloChatEmbedCode: String(input.zaloChatEmbedCode || '').trim(),
  }
}

export async function loadAdminIntegrationsConfigAction(
  fallbackEmbedCode: string
): Promise<{ data: IntegrationSettings } | { error: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }

  const admin = adminServiceClient()
  if (!admin) return { error: 'Thiếu SUPABASE_SERVICE_ROLE_KEY trên server.' }

  const { data, error } = await admin
    .from(SETTINGS_TABLE)
    .select('value_json')
    .eq('key', SETTINGS_KEY)
    .maybeSingle()

  if (error) return { error: error.message }

  const raw = (data?.value_json || {}) as Partial<IntegrationSettings>
  return { data: sanitizeSettings(raw, fallbackEmbedCode) }
}

export async function saveAdminIntegrationsConfigAction(
  input: Partial<IntegrationSettings>,
  fallbackEmbedCode: string
): Promise<{ ok: true } | { error: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }

  const admin = adminServiceClient()
  if (!admin) return { error: 'Thiếu SUPABASE_SERVICE_ROLE_KEY trên server.' }

  const payload = sanitizeSettings(input, fallbackEmbedCode)

  const { error } = await admin.from(SETTINGS_TABLE).upsert(
    {
      key: SETTINGS_KEY,
      value_json: payload,
      updated_by: gate.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  )
  if (error) return { error: error.message }

  revalidatePath('/admin/integrations')
  return { ok: true }
}

