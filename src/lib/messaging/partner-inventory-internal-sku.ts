import { randomInt } from 'node:crypto'
import type { InventoryCatalog188Fields } from '@/lib/messaging/partner-inventory-catalog-188'

/**
 * SKU shop SaaS: chữ hoa random cố định của shop + chữ thường random + 4 số.
 * Ví dụ `Qa0001`. Không lấy từ tên shop. Không dùng dạng 188 (`K0842`). Không dùng hậu tố 0000.
 */
const INTERNAL_SKU_RE = /^[A-Z][a-z][0-9]{4}$/
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const MAX_RANDOM_TRIES = 50_000

export function skuBlockKey(code: string | null | undefined): string {
  return (code ?? '').trim().toUpperCase()
}

export function canonicalPartnerInternalSku(code: string | null | undefined): string | null {
  const raw = (code ?? '').trim()
  if (!/^[A-Za-z]{2}[0-9]{4}$/.test(raw)) return null
  const sku = raw[0].toUpperCase() + raw[1].toLowerCase() + raw.slice(2)
  if (!INTERNAL_SKU_RE.test(sku) || sku.endsWith('0000')) return null
  return sku
}

export function internalSkuIsValidFormat(code: string | null | undefined): boolean {
  return canonicalPartnerInternalSku(code) != null
}

/** Random một chữ A–Z chưa gán cho shop khác. Gán một lần rồi giữ. */
export function assignShopSkuPrefixLetter(usedByOtherShops: Set<string>): string {
  const used = new Set(
    [...usedByOtherShops].map((letter) => letter.trim().toUpperCase()).filter((letter) => /^[A-Z]$/.test(letter))
  )
  const free = LETTERS.split('').filter((letter) => !used.has(letter))
  if (free.length === 0) {
    throw new Error('Hết chữ cái đầu SKU (A–Z). Mỗi shop một chữ, không dùng chung.')
  }
  return free[randomInt(0, free.length)]
}

export function allocatePartnerInternalSku(shopPrefix: string, blocked: Set<string>): string {
  const head = shopPrefix.trim().toUpperCase()
  if (!/^[A-Z]$/.test(head)) {
    throw new Error('Shop chưa có chữ cái đầu SKU.')
  }
  for (let i = 0; i < MAX_RANDOM_TRIES; i++) {
    const sku = `${head}${LOWER[randomInt(0, LOWER.length)]}${String(randomInt(1, 10000)).padStart(4, '0')}`
    const key = skuBlockKey(sku)
    if (blocked.has(key)) continue
    blocked.add(key)
    return sku
  }
  for (const second of LOWER) {
    for (let n = 1; n < 10000; n++) {
      const sku = `${head}${second}${String(n).padStart(4, '0')}`
      const key = skuBlockKey(sku)
      if (blocked.has(key)) continue
      blocked.add(key)
      return sku
    }
  }
  throw new Error(`Hết mã SKU trống (${head} + a–z + 0001–9999) trong shop này.`)
}

/**
 * Cấp SKU lúc ghi kho đăng web (Excel 41 cột / cào listing).
 * Mã đã điền thì giữ. Ô trống mà SP đã có SKU thì không đổi.
 * Mã dạng shop (`Qa0001`) trùng SP khác thì cấp mã mới cùng chữ đầu của shop.
 * File 12 cột (`assignIfEmpty` tắt) không sinh mã.
 */
export function resolvePartnerImportSku(input: {
  proposed: string | null | undefined
  existingSku: string | null | undefined
  assignIfEmpty: boolean
  shopPrefix: string
  blocked: Set<string>
}): string | null {
  const existing = (input.existingSku ?? '').trim()
  const proposedRaw = (input.proposed ?? '').trim()
  const takenByOther = (code: string) => {
    const key = skuBlockKey(code)
    if (!key) return false
    if (existing && skuBlockKey(existing) === key) return false
    return input.blocked.has(key)
  }

  if (proposedRaw) {
    const canonical = canonicalPartnerInternalSku(proposedRaw)
    if (canonical) {
      if (!takenByOther(canonical)) {
        input.blocked.add(skuBlockKey(canonical))
        return canonical
      }
    } else {
      input.blocked.add(skuBlockKey(proposedRaw))
      return proposedRaw.slice(0, 120)
    }
  }

  if (existing) {
    input.blocked.add(skuBlockKey(existing))
    return existing.slice(0, 120)
  }

  if (!input.assignIfEmpty) return null
  return allocatePartnerInternalSku(input.shopPrefix, input.blocked)
}

export function catalogWithInternalSku(
  catalog: InventoryCatalog188Fields | null | undefined,
  sku: string | null
): InventoryCatalog188Fields | null | undefined {
  if (!catalog?.catalog_json || !sku) return catalog
  if (catalog.catalog_json.code === sku) return catalog
  return { ...catalog, catalog_json: { ...catalog.catalog_json, code: sku } }
}
