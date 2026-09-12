/** SKU nguồn 1688/Tmall trên kho hoàn — parity 188 warehouse-sku.ts. Không publish listing. */

export type WarehouseSourceSkuKind = '1688' | 'tmall' | 'unknown'

export type WarehouseSourceSkuParts = {
  kind: WarehouseSourceSkuKind
  offerId: string
  size: string
  colorImageIndex: number | null
}

export function parseWarehouseSourceSkuParts(sku: string | null | undefined): WarehouseSourceSkuParts {
  const raw = String(sku || '').trim()
  const empty: WarehouseSourceSkuParts = { kind: 'unknown', offerId: raw, size: '', colorImageIndex: null }
  if (!raw) return empty
  const upper = raw.toUpperCase()
  const kind: WarehouseSourceSkuKind = upper.startsWith('A') ? '1688' : upper.startsWith('T') ? 'tmall' : 'unknown'
  const body = kind === 'unknown' ? raw : raw.slice(1)
  const parts = body.split('/').map((part) => part.trim()).filter(Boolean)
  if (parts.length === 0) return { ...empty, kind, offerId: kind === 'unknown' ? raw : body }
  const offerId = parts[0]
  if (parts.length === 1) return { kind, offerId, size: '', colorImageIndex: null }
  if (parts.length === 2) {
    const second = parts[1]
    if (/^\d+$/.test(second)) {
      return { kind, offerId, size: '', colorImageIndex: Math.max(0, Number.parseInt(second, 10) - 1) }
    }
    return { kind, offerId, size: second, colorImageIndex: null }
  }
  const size = parts[1]
  const colorRaw = parts[2]
  const colorImageIndex = /^\d+$/.test(colorRaw) ? Math.max(0, Number.parseInt(colorRaw, 10) - 1) : null
  return { kind, offerId, size, colorImageIndex }
}

export function warehouseColorHintFromGallery(
  galleryUrls: string[] | null | undefined,
  colorImageIndex: number | null
): string {
  if (colorImageIndex == null || colorImageIndex < 0) return ''
  const urls = Array.isArray(galleryUrls) ? galleryUrls.filter(Boolean) : []
  return urls[colorImageIndex] || ''
}

export function resolveWarehouseIntakeHints(input: {
  sku: string
  colors: string[]
  sizes: string[]
  galleryUrls?: string[]
}): { base: string; size: string; color: string; colorImageIndex: number | null; colorImageUrl: string } {
  const source = parseWarehouseSourceSkuParts(input.sku)
  if (source.kind !== 'unknown') {
    const colorName =
      source.colorImageIndex != null && input.colors[source.colorImageIndex]
        ? input.colors[source.colorImageIndex]
        : source.colorImageIndex != null
          ? `#${source.colorImageIndex + 1}`
          : ''
    const size =
      source.size && input.sizes.includes(source.size)
        ? source.size
        : source.size || ''
    return {
      base: source.offerId,
      size,
      color: colorName,
      colorImageIndex: source.colorImageIndex,
      colorImageUrl: warehouseColorHintFromGallery(input.galleryUrls, source.colorImageIndex),
    }
  }
  const parts = String(input.sku || '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
  return {
    base: parts[0] || '',
    size: parts[1] || '',
    color: parts[2] || '',
    colorImageIndex: null,
    colorImageUrl: '',
  }
}
