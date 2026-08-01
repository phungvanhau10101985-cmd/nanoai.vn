import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import { allRegisteredSectionTypes, PARTNER_WEBSITE_SECTION_REGISTRY } from '@/lib/partner-website/template/section-registry'

export type PartnerWebsitePlatformConfig = {
  defaultTemplateId: string
  enabledSectionTypes: string[]
}

const DEFAULT_CONFIG: PartnerWebsitePlatformConfig = {
  defaultTemplateId: 'landing-v1',
  enabledSectionTypes: allRegisteredSectionTypes(),
}

function mergePlatformLockedSections(config: PartnerWebsitePlatformConfig): PartnerWebsitePlatformConfig {
  const locked = PARTNER_WEBSITE_SECTION_REGISTRY.filter((s) => s.platformLocked).map((s) => s.type)
  return {
    ...config,
    enabledSectionTypes: [...new Set([...config.enabledSectionTypes, ...locked])],
  }
}

function parseConfig(raw: unknown): PartnerWebsitePlatformConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_CONFIG
  const o = raw as Record<string, unknown>
  const enabled = Array.isArray(o.enabledSectionTypes)
    ? o.enabledSectionTypes.filter((t): t is string => typeof t === 'string')
    : DEFAULT_CONFIG.enabledSectionTypes
  return {
    defaultTemplateId:
      typeof o.defaultTemplateId === 'string' ? o.defaultTemplateId : DEFAULT_CONFIG.defaultTemplateId,
    enabledSectionTypes: enabled.length ? enabled : DEFAULT_CONFIG.enabledSectionTypes,
  }
}

export async function fetchPartnerWebsitePlatformConfigPg(): Promise<PartnerWebsitePlatformConfig> {
  if (!isPgConfigured()) return DEFAULT_CONFIG
  try {
    const row = await pgQueryOne<{ value_json: unknown }>(
      `select value_json from public.partner_website_platform_settings
       where setting_key = 'section_registry' limit 1`
    )
    return mergePlatformLockedSections(parseConfig(row?.value_json))
  } catch (e) {
    console.error('[partner-website-platform-settings-pg] fetch', e)
    return DEFAULT_CONFIG
  }
}

export async function updatePartnerWebsitePlatformConfigPg(
  config: PartnerWebsitePlatformConfig
): Promise<PartnerWebsitePlatformConfig | null> {
  if (!isPgConfigured()) return null
  const safe: PartnerWebsitePlatformConfig = {
    defaultTemplateId: config.defaultTemplateId || 'landing-v1',
    enabledSectionTypes: config.enabledSectionTypes.filter((t) => allRegisteredSectionTypes().includes(t)),
  }
  if (!safe.enabledSectionTypes.length) {
    safe.enabledSectionTypes = DEFAULT_CONFIG.enabledSectionTypes
  }
  try {
    await pgQueryOne(
      `insert into public.partner_website_platform_settings (setting_key, value_json, updated_at)
       values ('section_registry', $1::jsonb, timezone('utc'::text, now()))
       on conflict (setting_key) do update set
         value_json = excluded.value_json,
         updated_at = excluded.updated_at
       returning setting_key`,
      [JSON.stringify(safe)]
    )
    return safe
  } catch (e) {
    console.error('[partner-website-platform-settings-pg] update', e)
    return null
  }
}
