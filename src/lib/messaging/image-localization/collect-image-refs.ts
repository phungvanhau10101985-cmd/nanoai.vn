import type { ImageRef } from './image-localization-types'
import { normalizeImageUrl } from './image-localization-config'

function asStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x ?? '').trim()).filter(Boolean)
}

function parseColors(raw: unknown): Array<{ name?: string; img?: string }> {
  if (!Array.isArray(raw)) return []
  return raw.filter((x) => x && typeof x === 'object') as Array<{ name?: string; img?: string }>
}

export function collectInventoryImageRefs(row: {
  image_url?: string | null
  colors_json?: unknown
  gallery_urls?: unknown
  detail_image_urls?: unknown
  material_detail_image_url?: string | null
}): ImageRef[] {
  const refs: ImageRef[] = []
  const colors = parseColors(row.colors_json)
  for (let i = 0; i < colors.length; i++) {
    const img = typeof colors[i]?.img === 'string' ? colors[i].img : ''
    if (img.trim()) refs.push({ bucket: 'colors', index: i, url: normalizeImageUrl(img) })
  }
  const gallery = asStringList(row.gallery_urls)
  for (let i = 0; i < gallery.length; i++) {
    refs.push({ bucket: 'gallery', index: i, url: normalizeImageUrl(gallery[i]) })
  }
  const detail = asStringList(row.detail_image_urls)
  for (let i = 0; i < detail.length; i++) {
    refs.push({ bucket: 'detail', index: i, url: normalizeImageUrl(detail[i]) })
  }
  if (typeof row.image_url === 'string' && row.image_url.trim()) {
    refs.push({ bucket: 'main_image', index: null, url: normalizeImageUrl(row.image_url) })
  }
  if (typeof row.material_detail_image_url === 'string' && row.material_detail_image_url.trim()) {
    refs.push({ bucket: 'material', index: null, url: normalizeImageUrl(row.material_detail_image_url) })
  }
  return refs
}

export function uniqueImageUrls(refs: ImageRef[], max: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const ref of refs) {
    const u = normalizeImageUrl(ref.url)
    if (!u || u === 'DELETED' || seen.has(u)) continue
    seen.add(u)
    out.push(u)
    if (max > 0 && out.length >= max) break
  }
  return out
}
