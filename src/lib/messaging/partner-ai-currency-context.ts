import { WEB_LOCALES, type WebLocale } from '@/lib/i18n/config'

/** Tỷ giá minh họa (VNĐ / đơn vị ngoại tệ) — chỉ để AI quy đổi gần đúng trong lời tư vấn, không phải giá niêm yết FX. */
const DEFAULT_VND_PER_UNIT = {
  usd: 25_500,
  cny: 3_500,
  /** 100 JPY tương đương bao nhiêu VNĐ */
  jpy100: 17_000,
  krw: 18,
}

function readEnvRate(key: string, fallback: number): number {
  const raw = process.env[key]?.trim()
  if (!raw) return fallback
  const n = Number.parseFloat(raw.replace(/_/g, ''))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * Khối nhắc AI: giá trong kho là VNĐ; khi UI khách không phải tiếng Việt thì có thể nêu thêm tương đương gần đúng theo tỷ giá tham chiếu.
 * Bật cho kênh `widget` và `ui_locale` ∈ en/zh/ja/ko.
 */
export function buildPartnerAiWarehouseVndPricingNote(opts?: {
  channel?: string | null
  uiLocale?: string | null
}): string {
  if (String(opts?.channel || '').trim().toLowerCase() !== 'widget') return ''
  const raw = String(opts?.uiLocale ?? '').trim()
  const loc = (WEB_LOCALES as readonly string[]).includes(raw) ? (raw as WebLocale) : null
  if (!loc || loc === 'vi') return ''

  const vndPerUsd = readEnvRate('PARTNER_AI_VND_PER_USD', DEFAULT_VND_PER_UNIT.usd)
  const vndPerCny = readEnvRate('PARTNER_AI_VND_PER_CNY', DEFAULT_VND_PER_UNIT.cny)
  const vndPer100Jpy = readEnvRate('PARTNER_AI_VND_PER_100_JPY', DEFAULT_VND_PER_UNIT.jpy100)
  const vndPerKrw = readEnvRate('PARTNER_AI_VND_PER_KRW', DEFAULT_VND_PER_UNIT.krw)

  return `[WAREHOUSE PRICES — Vietnamese đồng (VND / ₫)]
Every "Giá" / price field in the inventory lines below is an amount in **VND (₫)** unless that same line explicitly names another currency. In JSON \`message\`: keep the **shop price as VND** (same numbers as warehouse). Because the customer UI locale is **${loc}**, you may add **approximate equivalents** in the customer’s usual currency for convenience, using these **illustrative** reference rates only (not a trading quote): ~${vndPerUsd} ₫ ≈ 1 USD; ~${vndPerCny} ₫ ≈ 1 CNY; ~${vndPer100Jpy} ₫ ≈ 100 JPY; ~${vndPerKrw} ₫ ≈ 1 KRW. State clearly that equivalents are **rough estimates**. Override rates via env PARTNER_AI_VND_PER_USD, PARTNER_AI_VND_PER_CNY, PARTNER_AI_VND_PER_100_JPY, PARTNER_AI_VND_PER_KRW if needed.

`
}

export function shouldMarkInventoryPricesAsVndForAi(opts?: {
  channel?: string | null
  uiLocale?: string | null
}): boolean {
  if (String(opts?.channel || '').trim().toLowerCase() !== 'widget') return false
  const raw = String(opts?.uiLocale ?? '').trim()
  const loc = (WEB_LOCALES as readonly string[]).includes(raw) ? (raw as WebLocale) : null
  return Boolean(loc && loc !== 'vi')
}
