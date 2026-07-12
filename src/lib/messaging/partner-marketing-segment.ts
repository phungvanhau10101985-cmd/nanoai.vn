import type { MarketingSegmentRecipientRow } from '@/lib/db/messaging-partner-marketing-campaigns-pg'

export type MarketingSegmentPreset = 'chat_90d' | 'has_order' | 'custom'

export type MarketingSegmentJson = {
  preset?: MarketingSegmentPreset
  days_since_chat?: number
  require_has_order?: boolean
}

export const DEFAULT_MARKETING_SEGMENT: MarketingSegmentJson = {
  preset: 'chat_90d',
  days_since_chat: 90,
}

export const DEFAULT_MARKETING_TEMPLATE_CHAT = `Xin chào {customer_name},

{shop_name} có ưu đãi dành riêng cho bạn{offer_line}.

{interest_block}

Mở chat để xem giá và đặt hàng ngay trên hội thoại này.`

export const MARKETING_CAMPAIGN_COOLDOWN_DAYS = 14

export function normalizeMarketingSegmentJson(raw: unknown): MarketingSegmentJson {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_MARKETING_SEGMENT }
  }
  const obj = raw as Record<string, unknown>
  const presetRaw = String(obj.preset ?? 'chat_90d')
  const preset: MarketingSegmentPreset =
    presetRaw === 'has_order' || presetRaw === 'custom' ? presetRaw : 'chat_90d'
  const days = Math.max(1, Math.min(365, Math.floor(Number(obj.days_since_chat) || 90)))
  return {
    preset,
    days_since_chat: days,
    require_has_order: preset === 'has_order' || Boolean(obj.require_has_order),
  }
}

export function segmentRulesFromJson(seg: MarketingSegmentJson): {
  daysSinceChat: number
  requireHasOrder: boolean
} {
  const normalized = normalizeMarketingSegmentJson(seg)
  return {
    daysSinceChat: normalized.days_since_chat ?? 90,
    requireHasOrder: Boolean(normalized.require_has_order),
  }
}

export function formatSegmentRecipientLabel(r: MarketingSegmentRecipientRow): string {
  const name = r.customer_name?.trim()
  if (name) return name
  if (r.linked_user_id) return `User ${r.linked_user_id.slice(0, 8)}…`
  if (r.guest_account_id) return `Guest ${r.guest_account_id.slice(0, 8)}…`
  return `Thread ${r.external_thread_id.slice(0, 8)}…`
}
