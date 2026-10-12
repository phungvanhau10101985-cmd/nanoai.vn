import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { partnerSiteItFeatureHref } from '@/lib/partner-website/shop/partner-site-shop-paths'

export type ItFeatureCatalogRow = {
  id: string
  name: string
  product_url: string
}

export type ItFeatureIntentMatch =
  | { kind: 'links'; rows: ItFeatureCatalogRow[] }
  | { kind: 'pause' }
  | { kind: 'clarify' }

const STOP = new Set([
  'em',
  'anh',
  'chi',
  'shop',
  'toi',
  'minh',
  'muon',
  'can',
  'giup',
  'cho',
  'cai',
  'mot',
  'vao',
  'link',
  'nhu',
  'the',
  'nao',
  'oi',
  'nhe',
  'voi',
  'cua',
  'va',
  'hoac',
  'de',
  'lam',
  'tao',
  'su',
  'dung',
  'tinh',
  'nang',
  'mau',
  'nay',
  'a',
  'da',
  've',
  'them',
  'diem',
  'nao',
  'nhan',
  'tin',
  'tu',
  'van',
  'hoi',
  'want',
  'please',
  'the',
  'to',
  'for',
  'me',
])

const PAUSE_RE =
  /^(ok|okay|cam on|thanks|thank you|thoi|thoi nhe|khong can|bye|tam biet)( nhe| a| ban| shop| em)?$/

export function foldItFeatureText(value: string): string {
  return value
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokensOf(folded: string): string[] {
  const out: string[] = []
  for (const part of folded.split(' ')) {
    if (part.length < 2) continue
    if (STOP.has(part)) continue
    out.push(part)
  }
  return out
}

function personCount(folded: string): number | null {
  if (/\bmot nguoi\b/.test(folded)) return 1
  if (/\bhai nguoi\b/.test(folded)) return 2
  if (/\bba nguoi\b/.test(folded)) return 3
  if (/\bbon nguoi\b/.test(folded)) return 4
  if (/\bnam nguoi\b/.test(folded)) return 5
  const m = folded.match(/\b([1-5])\b/)
  if (m && /\bnguoi\b/.test(folded)) return Number(m[1])
  return null
}

function featurePath(productUrl: string): string {
  const href = partnerSiteItFeatureHref(productUrl)
  if (!href) return ''
  try {
    if (/^https?:\/\//i.test(href)) {
      const path = new URL(href).pathname
      return path.length > 1 ? path.replace(/\/$/, '') : path
    }
  } catch {
    return ''
  }
  return href.length > 1 ? href.replace(/\/$/, '') : href
}

/**
 * Không gọi từ inbound. Hub và shop CNTT dùng `resolveSharedFeatureOpen`.
 * Hàm này chỉ còn cho test kho cũ.
 */
export function matchItFeatureIntent(
  customerText: string,
  catalog: ItFeatureCatalogRow[]
): ItFeatureIntentMatch {
  const folded = foldItFeatureText(customerText)
  if (!folded) return { kind: 'clarify' }
  const queryTokens = new Set(tokensOf(folded))
  const count = personCount(folded)

  type Scored = { row: ItFeatureCatalogRow; hits: number; coverage: number }
  const scored: Scored[] = []
  for (const row of catalog) {
    const path = featurePath(row.product_url)
    if (!path) continue
    if (count && path.includes('-nguoi') && !path.includes(`/${count}-nguoi`) && !path.endsWith(`${count}-nguoi`)) {
      continue
    }
    const hay = tokensOf(foldItFeatureText(`${row.name} ${path.replace(/[/-]+/g, ' ')}`))
    const distinctive = hay.filter((token) => !STOP.has(token))
    const hits = distinctive.filter((token) => queryTokens.has(token))
    if (hits.length === 0) continue
    scored.push({
      row,
      hits: hits.length,
      coverage: hits.length / Math.max(1, distinctive.length),
    })
  }

  scored.sort((a, b) => b.hits - a.hits || b.coverage - a.coverage)
  const best = scored[0]?.hits ?? 0
  const tied = best > 0 ? scored.filter((row) => row.hits === best) : []
  if (tied.length >= 1 && tied.length <= 5) {
    return { kind: 'links', rows: tied.map((row) => row.row) }
  }
  if (PAUSE_RE.test(folded)) return { kind: 'pause' }
  return { kind: 'clarify' }
}

export async function fetchItFeatureCatalogFromPg(partnerId: string): Promise<ItFeatureCatalogRow[]> {
  if (!isPgConfigured()) return []
  const res = await getPgPool().query<{ id: string; name: string; product_url: string }>(
    `select id::text as id, name, product_url
     from public.messaging_partner_inventory
     where partner_id = $1::uuid
       and is_active is not false
       and coalesce(product_url, '') <> ''
     order by name`,
    [partnerId]
  )
  const rows: ItFeatureCatalogRow[] = []
  for (const row of res.rows) {
    const name = String(row.name ?? '').trim()
    const product_url = String(row.product_url ?? '').trim()
    if (!name || !partnerSiteItFeatureHref(product_url)) continue
    rows.push({ id: String(row.id), name, product_url })
  }
  return rows
}
