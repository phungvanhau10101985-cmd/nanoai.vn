import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'

export type NanoAiFacebookCatalogItem = {
  id: string
  title: string
  description: string
  availability: 'in stock' | 'out of stock'
  condition: 'new'
  priceVnd: number
  linkPath: string
  imagePath: string
  brand: string
}

const CREDIT_PACKS: Array<{ id: string; credits: number; priceVnd: number }> = [
  { id: 'credit_pack_1', credits: 1, priceVnd: CREDIT_UNIT_PRICE_VND },
  { id: 'credit_pack_2', credits: 2, priceVnd: CREDIT_UNIT_PRICE_VND * 2 },
  { id: 'credit_pack_5', credits: 5, priceVnd: CREDIT_UNIT_PRICE_VND * 5 },
  { id: 'credit_pack_10', credits: 10, priceVnd: CREDIT_UNIT_PRICE_VND * 10 },
  { id: 'credit_pack_20', credits: 20, priceVnd: CREDIT_UNIT_PRICE_VND * 20 },
  // Fallback generic item for custom top-up amounts outside predefined packs.
  { id: 'credit_pack_custom', credits: 1, priceVnd: CREDIT_UNIT_PRICE_VND },
]

export function listNanoAiFacebookCatalogItems(): NanoAiFacebookCatalogItem[] {
  return CREDIT_PACKS.map((pack) => ({
    id: pack.id,
    title: `NanoAI Credit Pack ${pack.credits}`,
    description: pack.id === 'credit_pack_custom'
      ? 'Flexible top-up package for NanoAI credits. Exact amount is determined at checkout.'
      : `Top up ${pack.credits} NanoAI credits for AI tools and services.`,
    availability: 'in stock',
    condition: 'new',
    priceVnd: pack.priceVnd,
    linkPath: '/wallet',
    imagePath: '/tool-icons/meeting-recorder-report.png',
    brand: 'NanoAI',
  }))
}

function csvEscapeCell(value: string): string {
  const s = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toAbsoluteUrl(origin: string, path: string): string {
  const base = origin.replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

function formatPriceVnd(v: number): string {
  return `${Math.max(0, Math.round(v))} VND`
}

export function buildNanoAiFacebookCatalogFeedCsv(origin: string): Buffer {
  const headers = [
    'id',
    'title',
    'description',
    'availability',
    'condition',
    'price',
    'link',
    'image_link',
    'brand',
  ]
  const rows = listNanoAiFacebookCatalogItems().map((item) => [
    item.id,
    item.title,
    item.description,
    item.availability,
    item.condition,
    formatPriceVnd(item.priceVnd),
    toAbsoluteUrl(origin, item.linkPath),
    toAbsoluteUrl(origin, item.imagePath),
    item.brand,
  ])
  const csv = [headers, ...rows]
    .map((line) => line.map((cell) => csvEscapeCell(String(cell))).join(','))
    .join('\r\n')
  return Buffer.from(`\ufeff${csv}\r\n`, 'utf8')
}

export function resolveNanoAiCreditCatalogItem(input: {
  amountVnd: number
  creditsAdded: number
}): NanoAiFacebookCatalogItem {
  const amount = Math.max(0, Math.round(Number(input.amountVnd) || 0))
  const credits = Math.max(0, Math.round(Number(input.creditsAdded) || 0))
  const items = listNanoAiFacebookCatalogItems()

  const exactPack = CREDIT_PACKS.find((pack) => pack.id !== 'credit_pack_custom' && pack.priceVnd === amount)
    ?? CREDIT_PACKS.find((pack) => pack.id !== 'credit_pack_custom' && pack.credits === credits)
  if (exactPack) {
    const item = items.find((x) => x.id === exactPack.id)
    if (item) return item
  }
  return items.find((x) => x.id === 'credit_pack_custom') ?? items[0]
}

export function buildNanoAiCreditMetaCustomData(input: {
  amountVnd: number
  creditsAdded: number
}): Record<string, string | number | boolean | Array<string | number | boolean>> {
  const item = resolveNanoAiCreditCatalogItem(input)
  const amount = Math.max(0, Math.round(Number(input.amountVnd) || 0))
  const credits = Math.max(0, Math.round(Number(input.creditsAdded) || 0))
  return {
    currency: 'VND',
    value: amount,
    credits_added: credits,
    content_name: 'NanoAI credits top-up',
    content_category: 'credits',
    content_type: 'product',
    content_ids: [item.id],
    num_items: 1,
  }
}
