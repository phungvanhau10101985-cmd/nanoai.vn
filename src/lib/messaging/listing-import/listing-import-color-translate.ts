import { deepseekPartnerChat } from '@/lib/messaging/partner-ai-llm'

const CJK_RE = /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/
const CYR_RE = /[\u0400-\u04FF]/
const VI_LATIN_RE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/
const SIZE_LIKE_RE = /^(xxl|xxxl|xxxxl|xs|xl|[sm])\s*$|^\d{2,3}\s*[-–/]\s*[a-z0-9]+\s*$/i
const EN_FASHION_COLOR_RE =
  /\b(black|white|red|blue|green|gold|silver|champagne|beige|navy|pink|grey|gray|brown|suede|leather|ivory|cream|rose|nude|khaki|burgundy|wine|purple|orange|yellow|tan|camel|apricot|mint|olive)\b/i

const CHUNK = 40

export function listingImportColorNeedsTranslate(name: string): boolean {
  const s = (name || '').trim()
  if (!s) return false
  if (CJK_RE.test(s) || CYR_RE.test(s)) return true
  if (VI_LATIN_RE.test(s)) return false
  if (SIZE_LIKE_RE.test(s.trim())) return false
  if (lenLatinFashion(s)) return true
  if (EN_FASHION_COLOR_RE.test(s) && /[A-Za-z]/.test(s) && !VI_LATIN_RE.test(s)) return true
  return false
}

function lenLatinFashion(t: string): boolean {
  if (t.length < 2 || t.length > 120) return false
  if (CJK_RE.test(t) || CYR_RE.test(t) || VI_LATIN_RE.test(t)) return false
  if (SIZE_LIKE_RE.test(t.trim())) return false
  if (!/[A-Za-z]/.test(t)) return false
  return /^[A-Za-z0-9\s\-–/.(),[\]%+]+$/.test(t)
}

function labelsFromFlatColors(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    let lab = ''
    if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>
      const v = rec.name == null || String(rec.name).trim() === '' ? rec.label : rec.name
      lab = v != null ? String(v).trim() : ''
    } else if (item != null) {
      lab = String(item).trim()
    }
    if (!lab) continue
    const k = lab.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(lab)
  }
  return out
}

/** Khớp 188 `collect_variant_color_labels` — colors[], không thì color_swatches. */
export function collectListingImportColorLabels(productData: Record<string, unknown>): string[] {
  const fromColors = labelsFromFlatColors(productData.colors)
  if (fromColors.length) return fromColors
  const pi = productData.product_info
  const variants = pi && typeof pi === 'object' ? (pi as Record<string, unknown>).variants : null
  if (!variants || typeof variants !== 'object') return []
  const sw = (variants as Record<string, unknown>).color_swatches
  if (!Array.isArray(sw)) return []
  const labels: string[] = []
  const seen = new Set<string>()
  for (const it of sw) {
    if (!it || typeof it !== 'object') continue
    const lab = String((it as Record<string, unknown>).label || '').trim()
    if (!lab) continue
    const k = lab.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    labels.push(lab)
  }
  return labels
}

/** Khớp 188 `collect_variant_color_label_strings` — colors + pairs + swatches (để dịch). */
export function collectListingImportColorLabelStrings(productData: Record<string, unknown>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (raw: unknown) => {
    const n = String(raw || '').trim()
    if (!n) return
    const k = n.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    out.push(n)
  }
  for (const item of (productData.colors as unknown[]) || []) {
    if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>
      push(rec.name || rec.label)
    } else {
      push(item)
    }
  }
  const pi = productData.product_info
  const variants = pi && typeof pi === 'object' ? (pi as Record<string, unknown>).variants : null
  if (variants && typeof variants === 'object') {
    const v = variants as Record<string, unknown>
    for (const po of (v.pairs as unknown[]) || []) {
      if (po && typeof po === 'object') push((po as Record<string, unknown>).color)
    }
    for (const sw of (v.color_swatches as unknown[]) || []) {
      if (sw && typeof sw === 'object') push((sw as Record<string, unknown>).label)
    }
  }
  const flat = String(productData.color || '').trim()
  if (flat && flat.includes(',')) {
    for (const part of flat.split(',')) push(part.trim())
  } else if (flat) {
    push(flat)
  }
  return out
}

/** Khớp 188 `_rebuild_flat_color_column`. */
export function rebuildListingImportFlatColorColumn(colors: unknown): string | null {
  const parts = labelsFromFlatColors(colors)
  return parts.length ? parts.join(', ') : null
}

async function translateChunk(unique: string[]): Promise<Record<string, string>> {
  if (!unique.length) return {}
  const r = await deepseekPartnerChat(
    'Bạn dịch tên màu/biến thể thời trang sang tiếng Việt ngắn gọn. Trả JSON object {"nguyên":"bản dịch",...}. Không markdown.',
    unique.map((n) => `- ${n}`).join('\n'),
    { feature: 'listing-import-color-translate', userId: null }
  )
  if (r.error || !r.text) return {}
  const start = r.text.indexOf('{')
  const end = r.text.lastIndexOf('}')
  if (start < 0 || end <= start) return {}
  try {
    const parsed = JSON.parse(r.text.slice(start, end + 1)) as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const src of unique) {
      const v = parsed[src]
      if (typeof v === 'string' && v.trim()) out[src] = v.trim().slice(0, 160)
    }
    return out
  } catch {
    return {}
  }
}

export async function applyListingImportColorTranslation(
  productData: Record<string, unknown>,
  warnings: string[]
): Promise<number> {
  const unique = collectListingImportColorLabelStrings(productData).filter(listingImportColorNeedsTranslate)
  if (!unique.length) return 0
  const mapping: Record<string, string> = {}
  for (let i = 0; i < unique.length; i += CHUNK) {
    Object.assign(mapping, await translateChunk(unique.slice(i, i + CHUNK)))
  }
  if (!Object.keys(mapping).length) {
    warnings.push('color_translate: DeepSeek không trả mapping.')
    return 0
  }
  let n = 0
  for (const item of (productData.colors as unknown[]) || []) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const name = String(rec.name || rec.label || '').trim()
    if (name && mapping[name]) {
      rec.name = mapping[name]
      delete rec.label
      n += 1
    }
  }
  const pi = productData.product_info
  if (pi && typeof pi === 'object') {
    const variants = (pi as Record<string, unknown>).variants
    if (variants && typeof variants === 'object') {
      const v = variants as Record<string, unknown>
      for (const po of (v.pairs as unknown[]) || []) {
        if (!po || typeof po !== 'object') continue
        const rec = po as Record<string, unknown>
        const cr = String(rec.color || '').trim()
        if (cr && mapping[cr]) {
          rec.color = mapping[cr]
          n += 1
        }
      }
      for (const sw of (v.color_swatches as unknown[]) || []) {
        if (!sw || typeof sw !== 'object') continue
        const rec = sw as Record<string, unknown>
        const lab = String(rec.label || '').trim()
        if (lab && mapping[lab]) {
          rec.label = mapping[lab]
          n += 1
        }
      }
      const flat = rebuildListingImportFlatColorColumn(productData.colors)
      if (flat) {
        v.colors = flat
        productData.color = flat.length > 500 ? flat.slice(0, 500).trim() : flat
      }
    }
  }
  const rebuilt = rebuildListingImportFlatColorColumn(productData.colors)
  if (rebuilt) productData.color = rebuilt.length > 500 ? rebuilt.slice(0, 500).trim() : rebuilt
  return n
}
