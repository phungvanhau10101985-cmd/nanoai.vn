export const FULFILLMENT_CHINA = 'china' as const
export const FULFILLMENT_VIETNAM = 'vietnam' as const
export type PartnerFulfillmentSource = typeof FULFILLMENT_CHINA | typeof FULFILLMENT_VIETNAM

export const SOURCE_1688 = '1688' as const
export const SOURCE_TAOBAO = 'taobao' as const
export const SOURCE_TMALL = 'tmall' as const
export type PartnerSourcePlatform = typeof SOURCE_1688 | typeof SOURCE_TAOBAO | typeof SOURCE_TMALL

const CHINA_HOST_SUFFIXES: Record<PartnerSourcePlatform, string> = {
  [SOURCE_1688]: '1688.com',
  [SOURCE_TAOBAO]: 'taobao.com',
  [SOURCE_TMALL]: 'tmall.com',
}

export function normalizedSourceHostname(sourceUrl: string | null | undefined): string {
  const raw = String(sourceUrl || '').trim()
  if (!raw) return ''
  const candidate = raw.includes('://') ? raw : `https://${raw}`
  try {
    return (new URL(candidate).hostname || '').replace(/^\.+|\.+$/g, '').toLowerCase()
  } catch {
    return ''
  }
}

/** Chỉ host thật hoặc subdomain của 1688/Taobao/Tmall — không tin query `?next=taobao.com`. */
export function sourcePlatformFromUrl(sourceUrl: string | null | undefined): PartnerSourcePlatform | null {
  const host = normalizedSourceHostname(sourceUrl)
  if (!host) return null
  for (const [platform, suffix] of Object.entries(CHINA_HOST_SUFFIXES) as Array<[PartnerSourcePlatform, string]>) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return platform
  }
  return null
}

export function fulfillmentSourceFromUrl(sourceUrl: string | null | undefined): PartnerFulfillmentSource {
  return sourcePlatformFromUrl(sourceUrl) ? FULFILLMENT_CHINA : FULFILLMENT_VIETNAM
}

export function classifyLegacyItemSource(input: {
  snapshotUrl?: string | null
  productUrl?: string | null
  productExists: boolean
  snapshotSource?: string | null
}): { source: PartnerFulfillmentSource; url: string | null; needsReview: boolean } {
  let resolved = String(input.snapshotUrl || '').trim()
  if (!resolved && input.productExists) resolved = String(input.productUrl || '').trim()
  if (!resolved && !input.productExists) {
    const snap = String(input.snapshotSource || '').trim().toLowerCase()
    const source: PartnerFulfillmentSource =
      snap === FULFILLMENT_CHINA || snap === FULFILLMENT_VIETNAM ? snap : FULFILLMENT_VIETNAM
    return { source, url: null, needsReview: true }
  }
  return { source: fulfillmentSourceFromUrl(resolved), url: resolved || null, needsReview: false }
}

export function catalogLinkDefault(catalogJson: unknown): string {
  if (!catalogJson || typeof catalogJson !== 'object' || Array.isArray(catalogJson)) return ''
  const value = (catalogJson as Record<string, unknown>).link_default
  return typeof value === 'string' ? value.trim() : ''
}

/** Ưu tiên URL có host 1688/Taobao/Tmall thật — quote và checkout dùng cùng hàm. */
export function resolveInventoryFulfillmentUrl(input: {
  catalogJson?: unknown
  productUrl?: string | null
  fallbackUrl?: string | null
}): string {
  const catalog = catalogLinkDefault(input.catalogJson)
  const product = String(input.productUrl || '').trim()
  const fallback = String(input.fallbackUrl || '').trim()
  const candidates = [product, catalog, fallback].filter(Boolean)
  const china = candidates.find((url) => fulfillmentSourceFromUrl(url) === FULFILLMENT_CHINA)
  return china || product || catalog || fallback || ''
}

/** Phân bổ số nguyên (VND); phần dư dồn vào khóa cuối. */
export function allocateIntegerTotal(
  total: number,
  weights: Record<string, number>,
  orderedKeys: string[]
): Record<string, number> {
  const result: Record<string, number> = {}
  let left = Math.max(0, Math.round(total))
  const weightTotal = orderedKeys.reduce((sum, key) => sum + Math.max(0, Math.round(weights[key] || 0)), 0)
  for (let index = 0; index < orderedKeys.length; index += 1) {
    const key = orderedKeys[index]
    let amount = 0
    if (index === orderedKeys.length - 1) {
      amount = left
    } else if (weightTotal > 0) {
      amount = Math.round((Math.max(0, Math.round(total)) * Math.max(0, Math.round(weights[key] || 0))) / weightTotal)
    }
    amount = Math.max(0, Math.min(amount, left))
    result[key] = amount
    left -= amount
  }
  return result
}
