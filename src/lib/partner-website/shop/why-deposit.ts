import type { WebLocale } from '@/lib/i18n/config'
import {
  clampPartnerDepositPercent,
  clampPartnerMinDepositAmount,
  readHighUnitPriceDepositSettings,
} from '@/lib/messaging/partner-deposit-amount'
import { getWhyDepositCopy, type WhyDepositCopy } from '@/lib/partner-website/shop/why-deposit-copy'

export type WhyDepositPolicy = {
  percent: number
  minAmount: number
  highOrderAmount: number
  highOrderPercent: number
}

const ORDER_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function oneWhyDepositQuery(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

/** Order id from `?order=`. UUID shop orders, or a short numeric id like 188. */
export function safeWhyDepositOrderId(raw: string): string | null {
  const id = raw.trim()
  if (ORDER_UUID.test(id)) return id
  if (/^\d{1,12}$/.test(id)) {
    const n = Number(id)
    return Number.isInteger(n) && n > 0 ? id : null
  }
  return null
}

/** Order code from `?code=`. Letters and digits only, same idea as 188. */
export function safeWhyDepositOrderCode(raw: string): string {
  const code = raw.trim()
  return /^[A-Za-z0-9]{2,32}$/.test(code) ? code : ''
}

export function whyDepositPolicyFromSettings(
  input?: {
    default_deposit_percent?: number | null
    min_deposit_amount_vnd?: number | null
    high_unit_price_deposit_threshold_vnd?: number | null
    high_unit_price_min_deposit_percent?: number | null
  } | null
): WhyDepositPolicy {
  const high = readHighUnitPriceDepositSettings({
    thresholdVnd: input?.high_unit_price_deposit_threshold_vnd,
    minPercent: input?.high_unit_price_min_deposit_percent,
  })
  return {
    percent: clampPartnerDepositPercent(input?.default_deposit_percent ?? 30, 30),
    minAmount: clampPartnerMinDepositAmount(input?.min_deposit_amount_vnd),
    highOrderAmount: high.thresholdVnd,
    highOrderPercent: high.minPercent,
  }
}

export function fillWhyDeposit(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z0-9]+)\}/g, (_, key: string) => {
    const value = vars[key]
    return value == null ? '' : String(value)
  })
}

export function whyDepositZaloMessage(
  locale: WebLocale,
  orderCode: string,
  shopName: string
): string {
  return whyDepositZaloMessageFromCopy(getWhyDepositCopy(locale), orderCode, shopName)
}

export function whyDepositZaloMessageFromCopy(
  copy: WhyDepositCopy,
  orderCode: string,
  shopName: string
): string {
  const shop = shopName.trim() || 'shop'
  if (orderCode.trim()) {
    return fillWhyDeposit(copy.zaloMessageWithCode, { code: orderCode.trim(), shop })
  }
  return fillWhyDeposit(copy.zaloMessagePlain, { shop })
}

export function isWhyDepositHttpUrl(raw: string | null | undefined): boolean {
  const text = String(raw ?? '').trim()
  if (!text) return false
  try {
    const url = new URL(text)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}
