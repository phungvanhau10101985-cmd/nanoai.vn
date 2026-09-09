/**
 * Ghép URL Vipomall / PandaMall từ dòng parse listing — khớp trang taobao-cards-parse (188).
 */

import { extractOfferId1688FromHref, type ParsedTaobaoCardRow } from './taobao-cards-html-parse'
import {
  buildCanonical1688ProductId,
  buildCanonicalTaobaoProductId,
  extract1688OfferId,
  extractTaobaoTmallItemId,
  normalizeProductImportUrl,
  parseTPrefixedItemId,
} from './import-source-ids'

export const VIPOMALL_PLATFORM_1688 = 10
export const VIPOMALL_PLATFORM_TAOBAO = 21

export type ListingImportSource = 'vipomall' | 'pandamall'
export type ListingImportFetchTarget = 'auto' | 'vipomall' | 'pandamall'

export function buildVipomallPdpUrl(offerId: string, platformType: number = VIPOMALL_PLATFORM_1688): string {
  const oid = String(offerId || '').trim()
  if (!/^\d+$/.test(oid)) return ''
  const pt = platformType === VIPOMALL_PLATFORM_TAOBAO ? VIPOMALL_PLATFORM_TAOBAO : VIPOMALL_PLATFORM_1688
  return `https://vipomall.vn/san-pham/${oid}?platform_type=${pt}`
}

export function buildPandamallTaobaoPdpUrl(itemId: string): string {
  const oid = String(itemId || '').trim()
  return /^\d+$/.test(oid) ? `https://pandamall.vn/taobao/detail/${oid}` : ''
}

export function buildPandamall1688PdpUrl(offerId: string): string {
  const oid = String(offerId || '').trim()
  return /^\d+$/.test(oid) ? `https://pandamall.vn/1688/detail/${oid}` : ''
}

export function extractVipomallOfferId(raw: string): string | null {
  const norm = normalizeProductImportUrl(raw)
  if (!norm) return null
  try {
    const p = new URL(norm)
    const host = (p.hostname || '').replace(/^www\./i, '')
    if (!/^vipomall\.vn$/i.test(host)) return null
    const m = /^\/san-pham\/(\d+)/i.exec(p.pathname || '')
    if (m?.[1]) return m[1]
    for (const key of ['offerId', 'offerid', 'id', 'itemId']) {
      const val = p.searchParams.get(key)?.trim()
      if (val && /^\d+$/.test(val)) return val
    }
  } catch {
    return null
  }
  return null
}

export function extractVipomallPlatformType(raw: string): number | null {
  const norm = normalizeProductImportUrl(raw)
  if (!norm) return null
  try {
    const p = new URL(norm)
    for (const key of ['platform_type', 'platformType']) {
      const val = p.searchParams.get(key)?.trim()
      if (val && /^\d+$/.test(val)) return Number(val)
    }
  } catch {
    return null
  }
  return null
}

export function extractPandamallDetail(raw: string): { itemId: string; platform: 'taobao' | '1688' } | null {
  const norm = normalizeProductImportUrl(raw)
  if (!norm) return null
  try {
    const p = new URL(norm)
    const host = (p.hostname || '').replace(/^www\./i, '')
    if (!/^pandamall\.vn$/i.test(host)) return null
    const m = /^\/(taobao|1688)\/detail\/(\d+)/i.exec(p.pathname || '')
    if (!m) return null
    const platform = m[1].toLowerCase() === 'taobao' ? 'taobao' : '1688'
    return { itemId: m[2], platform }
  } catch {
    return null
  }
}

function pick1688OfferIdFromListingRow(r: ParsedTaobaoCardRow): string | null {
  const fromHref = extractOfferId1688FromHref(r.item_url || '')
  if (fromHref) return fromHref
  const id = (r.item_id || '').trim()
  const m = /^A(\d{6,})$/i.exec(id)
  return m?.[1] ?? null
}

export function listingRowToVipomallImportUrl(r: ParsedTaobaoCardRow): string | null {
  const id = (r.item_id || '').trim()
  const u = (r.item_url || '').trim().toLowerCase()

  const taobaoIdFromPrefix = /^[Tt](\d+)$/.exec(id)?.[1] ?? null
  if (taobaoIdFromPrefix) {
    return buildVipomallPdpUrl(taobaoIdFromPrefix, VIPOMALL_PLATFORM_TAOBAO)
  }

  const oid1688 = pick1688OfferIdFromListingRow(r)
  if (oid1688) {
    if (u.includes('vipomall.vn')) {
      const m = u.match(/\/san-pham\/(\d+)/)
      if (m?.[1]) {
        const pt = u.includes('platform_type=21') ? VIPOMALL_PLATFORM_TAOBAO : VIPOMALL_PLATFORM_1688
        return buildVipomallPdpUrl(m[1], pt)
      }
    }
    return buildVipomallPdpUrl(oid1688, VIPOMALL_PLATFORM_1688)
  }

  const onlyDigits = id.replace(/\D/g, '')
  if (onlyDigits && (u.includes('taobao') || u.includes('tmall'))) {
    return buildVipomallPdpUrl(onlyDigits, VIPOMALL_PLATFORM_TAOBAO)
  }
  return null
}

export function listingRowToPandamallImportUrl(r: ParsedTaobaoCardRow): string | null {
  const id = (r.item_id || '').trim()
  const u = (r.item_url || '').trim().toLowerCase()

  const taobaoIdFromPrefix = /^[Tt](\d+)$/.exec(id)?.[1] ?? null
  if (taobaoIdFromPrefix) return buildPandamallTaobaoPdpUrl(taobaoIdFromPrefix)

  if (u.includes('pandamall.vn')) {
    const m = u.match(/\/(1688|taobao)\/detail\/(\d+)/)
    if (m?.[1] && m?.[2]) return `https://pandamall.vn/${m[1]}/detail/${m[2]}`
  }

  const oid1688 = pick1688OfferIdFromListingRow(r)
  if (oid1688) return buildPandamall1688PdpUrl(oid1688)

  const onlyDigits = id.replace(/\D/g, '')
  if (onlyDigits && (u.includes('taobao') || u.includes('tmall'))) {
    return buildPandamallTaobaoPdpUrl(onlyDigits)
  }
  return null
}

export function resolveListingImportTask(
  r: ParsedTaobaoCardRow,
  target: ListingImportFetchTarget
): { url: string; source: ListingImportSource } | null {
  const vipomallUrl = listingRowToVipomallImportUrl(r)
  const pandamallUrl = listingRowToPandamallImportUrl(r)
  if (target === 'vipomall') {
    if (!vipomallUrl) return null
    return { url: vipomallUrl, source: 'vipomall' }
  }
  if (target === 'pandamall') {
    if (!pandamallUrl) return null
    return { url: pandamallUrl, source: 'pandamall' }
  }
  if (vipomallUrl) return { url: vipomallUrl, source: 'vipomall' }
  if (pandamallUrl) return { url: pandamallUrl, source: 'pandamall' }
  return null
}

export function resolveVipomallImportUrl(raw: string): { url: string; platformType: number } {
  const trimmed = (raw || '').trim()
  const tidPref = parseTPrefixedItemId(trimmed)
  if (tidPref) return { url: buildVipomallPdpUrl(tidPref, VIPOMALL_PLATFORM_TAOBAO), platformType: VIPOMALL_PLATFORM_TAOBAO }

  const norm = normalizeProductImportUrl(trimmed)
  if (!norm) throw new Error('Link Vipomall/Taobao không hợp lệ.')

  const existing = extractVipomallOfferId(norm)
  if (existing) {
    const explicit = extractVipomallPlatformType(norm)
    const pt =
      explicit === VIPOMALL_PLATFORM_TAOBAO || explicit === VIPOMALL_PLATFORM_1688
        ? explicit
        : parseTPrefixedItemId(norm) || extractTaobaoTmallItemId(norm)
          ? VIPOMALL_PLATFORM_TAOBAO
          : VIPOMALL_PLATFORM_1688
    return { url: buildVipomallPdpUrl(existing, pt), platformType: pt }
  }

  const tid = extractTaobaoTmallItemId(norm)
  if (tid) return { url: buildVipomallPdpUrl(tid, VIPOMALL_PLATFORM_TAOBAO), platformType: VIPOMALL_PLATFORM_TAOBAO }

  const oid1688 = extract1688OfferId(norm)
  if (oid1688 && /^\d+$/.test(oid1688)) {
    return { url: buildVipomallPdpUrl(oid1688, VIPOMALL_PLATFORM_1688), platformType: VIPOMALL_PLATFORM_1688 }
  }

  throw new Error(
    'Không quy đổi được sang Vipomall. Cần link Taobao/Tmall, T{id}, offer 1688, hoặc vipomall.vn/san-pham/{id}.'
  )
}

export function resolvePandamallImportUrl(raw: string): { url: string; platform: 'taobao' | '1688' } {
  const trimmed = (raw || '').trim()
  const detail = extractPandamallDetail(trimmed)
  if (detail) {
    const url =
      detail.platform === 'taobao' ? buildPandamallTaobaoPdpUrl(detail.itemId) : buildPandamall1688PdpUrl(detail.itemId)
    return { url, platform: detail.platform }
  }

  const norm = normalizeProductImportUrl(trimmed)
  if (!norm) throw new Error('Link PandaMall/Taobao/1688 không hợp lệ.')

  const tid = parseTPrefixedItemId(norm) || extractTaobaoTmallItemId(norm)
  if (tid) return { url: buildPandamallTaobaoPdpUrl(tid), platform: 'taobao' }

  const oid1688 = extract1688OfferId(norm)
  if (oid1688 && /^\d+$/.test(oid1688)) return { url: buildPandamall1688PdpUrl(oid1688), platform: '1688' }

  throw new Error(
    'Không quy đổi được sang PandaMall. Cần link pandamall.vn/taobao|1688/detail/{id}, Taobao/Tmall, T{id}, hoặc offer 1688.'
  )
}

export function inferListingImportSource(url: string, hinted?: string | null): ListingImportSource {
  const src = String(hinted || '')
    .trim()
    .toLowerCase()
  if (src === 'pandamall' || src === 'panda' || src === 'panda_mall' || src === 'panda-mall') {
    return 'pandamall'
  }
  if (src === 'vipomall' || src === 'vipo' || src === 'vipomail' || src === 'vipo_mall' || src === 'vipo-mall') {
    return 'vipomall'
  }
  const u = String(url || '').toLowerCase()
  if (u.includes('pandamall.vn')) return 'pandamall'
  return 'vipomall'
}

export function inferCanonicalProductId(source: ListingImportSource, sourceUrl: string, offerId: string): string {
  if (source === 'pandamall') {
    const d = extractPandamallDetail(sourceUrl)
    if (d?.platform === 'taobao') return buildCanonicalTaobaoProductId(d.itemId)
    return buildCanonical1688ProductId(d?.itemId || offerId)
  }
  const pt = extractVipomallPlatformType(sourceUrl)
  if (pt === VIPOMALL_PLATFORM_TAOBAO) return buildCanonicalTaobaoProductId(offerId)
  return buildCanonical1688ProductId(offerId)
}
