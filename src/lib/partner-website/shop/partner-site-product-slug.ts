/** Public product URL key: `{name-slug}-{uuid8}` (still accepts bare UUID). */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isPartnerInventoryUuid(value: string): boolean {
  return UUID_RE.test(value.trim())
}

function stripDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

/** ASCII slug from product title (Vietnamese-safe). */
export function slugifyPartnerProductName(name: string, maxLen = 72): string {
  const s = stripDiacritics(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/-+$/g, '')
  return s || 'san-pham'
}

/** First 8 hex chars of UUID (before first dash). */
export function partnerInventoryIdSlugSuffix(inventoryId: string): string | null {
  const id = inventoryId.trim().toLowerCase()
  if (!UUID_RE.test(id)) return null
  return id.slice(0, 8)
}

/**
 * Build public product path segment from name + inventory id.
 * Example: "Túi Đeo Chéo..." + 00073cac-… → `tui-deo-cheo-...-00073cac`
 */
export function buildPartnerSiteProductKey(
  name: string | null | undefined,
  inventoryId: string
): string {
  const id = inventoryId.trim()
  const suffix = partnerInventoryIdSlugSuffix(id)
  if (!suffix) return id || 'san-pham'
  const base = slugifyPartnerProductName(name ?? '')
  return `${base}-${suffix}`
}

export type ParsedPartnerProductKey =
  | { kind: 'uuid'; inventoryId: string }
  | { kind: 'slug'; idPrefix: string; nameSlug: string }

/** Parse `/products/{key}` — UUID (legacy) or `{slug}-{uuid8}`. */
export function parsePartnerSiteProductKey(raw: string): ParsedPartnerProductKey | null {
  const key = decodeURIComponent(raw.trim())
  if (!key) return null
  if (UUID_RE.test(key)) {
    return { kind: 'uuid', inventoryId: key.toLowerCase() }
  }
  const m = key.match(/^(.+)-([0-9a-f]{8})$/i)
  if (!m?.[1] || !m[2]) return null
  return {
    kind: 'slug',
    nameSlug: m[1].toLowerCase(),
    idPrefix: m[2].toLowerCase(),
  }
}
