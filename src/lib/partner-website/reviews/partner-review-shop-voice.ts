import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

/**
 * Pool đánh giá import dùng chung mọi shop, nhưng chữ ký shop trong câu trả lời
 * (hostname thương hiệu) phải hiện theo shop đang xem. Không ghi đè dòng gốc.
 */

export type ShopVoice = {
  ownLabel: string
  foreignLabels: string[]
}

const HOST_LABEL = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i

export function isShopHostLabel(raw: string): boolean {
  const label = raw.trim()
  if (label.length < 4 || label.length > 200) return false
  if (/\s/.test(label)) return false
  return HOST_LABEL.test(label)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Đổi hostname shop khác thành hostname shop đang xem. Không đụng subdomain (cdn.shop.vn). */
export function rewriteForeignShopHosts(text: string, voice: ShopVoice | null): string {
  if (!voice?.ownLabel || !text) return text
  const own = voice.ownLabel.trim()
  if (!own) return text
  const labels = [...new Set(voice.foreignLabels.map((label) => label.trim()).filter(Boolean))]
    .filter((label) => label.toLowerCase() !== own.toLowerCase() && isShopHostLabel(label))
    .sort((a, b) => b.length - a.length)
  let out = text
  for (const label of labels) {
    const pattern = new RegExp(`(?<![A-Za-z0-9.-])${escapeRegExp(label)}(?![A-Za-z0-9.-])`, 'gi')
    out = out.replace(pattern, own)
  }
  return out
}

export function replyMatchesShopVoice(stored: string, shown: string, voice: ShopVoice | null): boolean {
  const raw = stored ?? ''
  const next = shown ?? ''
  if (next.trim() === raw.trim()) return true
  return rewriteForeignShopHosts(raw, voice).trim() === next.trim()
}

type VoiceRow = {
  partner_id: string
  brand_name: string | null
  display_name: string | null
  hostname: string | null
}

let voiceCache: { at: number; rows: VoiceRow[] } | null = null
const VOICE_CACHE_MS = 60_000

function hostOf(row: VoiceRow): string {
  const hostname = row.hostname?.trim() || ''
  if (isShopHostLabel(hostname)) return hostname
  const brand = row.brand_name?.trim() || ''
  if (isShopHostLabel(brand)) return brand
  const display = row.display_name?.trim() || ''
  if (isShopHostLabel(display)) return display
  return ''
}

async function loadVoiceRows(): Promise<VoiceRow[]> {
  const now = Date.now()
  if (voiceCache && now - voiceCache.at < VOICE_CACHE_MS) return voiceCache.rows
  if (!isPgConfigured()) return []
  const rows = await pgQuery<VoiceRow>(
    `select p.id::text as partner_id,
            nullif(trim(p.brand_name), '') as brand_name,
            nullif(trim(p.display_name), '') as display_name,
            nullif(trim(d.hostname), '') as hostname
     from public.messaging_partners p
     left join lateral (
       select hostname
       from public.messaging_partner_custom_domains
       where partner_id = p.id
         and coalesce(hostname, '') <> ''
       order by use_for_site desc, created_at asc
       limit 1
     ) d on true
     where coalesce(p.is_active, true) = true
       and p.purge_at is null`
  )
  voiceCache = { at: now, rows }
  return rows
}

export async function shopVoiceForPartner(partnerId: string): Promise<ShopVoice | null> {
  const pid = partnerId.trim()
  if (!pid) return null
  try {
    const rows = await loadVoiceRows()
    const own = rows.find((row) => row.partner_id === pid)
    if (!own) return null
    const ownLabel = hostOf(own)
    if (!ownLabel) return null
    const foreignLabels: string[] = []
    for (const row of rows) {
      if (row.partner_id === pid) continue
      const label = hostOf(row)
      if (label) foreignLabels.push(label)
    }
    return { ownLabel, foreignLabels }
  } catch (e) {
    console.warn('[shopVoiceForPartner]', e)
    return null
  }
}
