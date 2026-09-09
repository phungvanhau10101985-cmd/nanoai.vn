import type { ImageLocClassifyType, ImageLocOcrBlock } from './image-localization-types'
import {
  IMAGE_LOC_COMPLEX_KEYWORDS,
  IMAGE_LOC_DOMAIN_REGEX,
  IMAGE_LOC_FACTORY_INTRO_KEYWORDS,
  IMAGE_LOC_LAUNDRY_KEYWORDS,
  IMAGE_LOC_LAUNDRY_STRONG_PATTERNS,
  IMAGE_LOC_SIZE_LABELS,
  IMAGE_LOC_SIZE_TABLE_KEYWORDS,
  IMAGE_LOC_SIZE_TABLE_TITLE_PATTERNS,
  IMAGE_LOC_URGENT_DELETE_KEYWORDS,
} from './image-localization-keywords'

const HANZI_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/

export function isRealChineseHanzi(char: string): boolean {
  if (!char || char.length !== 1) return false
  const cp = char.codePointAt(0) ?? 0
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0x20000 && cp <= 0x2a6df)
  )
}

export function countHanzi(text: string): { count: number; chars: string[] } {
  const chars: string[] = []
  for (const ch of text || '') {
    if (isRealChineseHanzi(ch)) chars.push(ch)
  }
  return { count: chars.length, chars }
}

export function hasChineseText(text: string): boolean {
  return HANZI_RE.test(text || '')
}

function compactText(texts: string[]): string {
  return texts.join('\n').toLowerCase().replace(/[\s\u3000:_：\-|/]+/g, '')
}

export function hasFactoryIntroContext(blocks: ImageLocOcrBlock[]): boolean {
  const combined = blocks.map((b) => b.text || '').join('\n')
  return IMAGE_LOC_FACTORY_INTRO_KEYWORDS.some((k) => combined.includes(k))
}

export function hasSizeTableContext(blocks: ImageLocOcrBlock[]): boolean {
  const texts = blocks.map((b) => String(b.text || '')).filter((t) => t.trim())
  if (!texts.length) return false
  const compact = compactText(texts)
  if (IMAGE_LOC_SIZE_TABLE_TITLE_PATTERNS.some((p) => compact.includes(p))) return true
  const labelCount = IMAGE_LOC_SIZE_LABELS.reduce((n, label) => n + (compact.includes(label) ? 1 : 0), 0)
  let sizeTokenCount = 0
  for (const text of texts) {
    const t = text.toLowerCase().replace(/[\s\u3000]+/g, '')
    if (/^(?:xxxs|xxs|xs|s|m|l|xl|xxl|xxxl|xxxxl|\d{2,3})(?:[-/](?:xxxs|xxs|xs|s|m|l|xl|xxl|xxxl|xxxxl|\d{2,3}))*$/.test(t)) {
      sizeTokenCount += 1
    } else if (/^\d+(?:[.,]\d+)?(?:cm|mm|kg|g|斤)?$/.test(t)) {
      sizeTokenCount += 1
    }
  }
  const combined = texts.join('\n').toLowerCase()
  const hasSizeKeyword = ['尺码', '尺寸', 'size'].some((k) => compact.includes(k))
  const hasUnit = /(?:cm|厘米|mm|kg|斤)/i.test(combined)
  if (hasSizeKeyword && labelCount >= 1 && sizeTokenCount >= 3) return true
  if (labelCount >= 2 && sizeTokenCount >= 5) return true
  return labelCount >= 2 && hasUnit && sizeTokenCount >= 3
}

export function hasLaundryCareContext(blocks: ImageLocOcrBlock[]): boolean {
  const texts = blocks.map((b) => String(b.text || '')).filter((t) => t.trim())
  if (!texts.length) return false
  const compact = compactText(texts)
  if (IMAGE_LOC_LAUNDRY_STRONG_PATTERNS.some((p) => compact.includes(p))) return true
  const detected = new Set<string>()
  for (const text of texts) {
    for (const kw of IMAGE_LOC_LAUNDRY_KEYWORDS) {
      if (text.includes(kw) || text.toLowerCase().includes(kw.toLowerCase())) detected.add(kw)
    }
  }
  if (detected.size < 2) return false
  return /手洗|机洗|水洗|干洗|漂白|熨烫|烘干|handwash|machinewash|dryclean|bleach|iron|tumbledry/.test(compact)
}

export function hasSizeOrLaundryContext(blocks: ImageLocOcrBlock[]): boolean {
  return hasSizeTableContext(blocks) || hasLaundryCareContext(blocks)
}

function urgentDeleteHit(text: string): string | null {
  const t = text || ''
  for (const kw of IMAGE_LOC_URGENT_DELETE_KEYWORDS) {
    if (!kw) continue
    if (kw.length === 1) {
      if (t.includes(kw)) return kw
      continue
    }
    if (t.includes(kw) || t.toLowerCase().includes(kw.toLowerCase())) return kw
  }
  return null
}

function containsComplexKeyword(blocks: ImageLocOcrBlock[]): string | null {
  for (const b of blocks) {
    const t = b.text || ''
    for (const kw of IMAGE_LOC_COMPLEX_KEYWORDS) {
      if (t.includes(kw) || t.toLowerCase().includes(kw.toLowerCase())) return kw
    }
  }
  return null
}

function overlapRatio(blocks: ImageLocOcrBlock[]): number {
  if (blocks.length < 2) return 0
  let hits = 0
  let pairs = 0
  for (let i = 0; i < blocks.length; i++) {
    const a = blocks[i].bbox
    for (let j = i + 1; j < blocks.length; j++) {
      const b = blocks[j].bbox
      pairs += 1
      const ax1 = a[0]
      const ay1 = a[1]
      const ax2 = a[2]
      const ay2 = a[3]
      const bx1 = b[0]
      const by1 = b[1]
      const bx2 = b[2]
      const by2 = b[3]
      const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1))
      const iy = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1))
      const inter = ix * iy
      const areaA = Math.max(1, (ax2 - ax1) * (ay2 - ay1))
      if (inter / areaA > 0.05) hits += 1
    }
  }
  return pairs ? hits / pairs : 0
}

export function classifyImage(
  blocks: ImageLocOcrBlock[],
  _ignore: ImageLocOcrBlock[],
  _originalUrl: string
): { type: ImageLocClassifyType; reason: string; details: Record<string, unknown> } {
  const nonempty = blocks.filter((b) => (b.text || '').trim())
  for (const b of nonempty) {
    const hit = urgentDeleteHit(b.text)
    if (hit) {
      return {
        type: 'delete',
        reason: `URGENT DELETE: ${hit}`,
        details: { detected_keyword: hit, text_snippet: b.text.slice(0, 100), urgent_delete: true },
      }
    }
  }

  let totalHanzi = 0
  const allHanzi: string[] = []
  for (const b of nonempty) {
    const { count, chars } = countHanzi(b.text)
    totalHanzi += count
    allHanzi.push(...chars)
  }
  if (totalHanzi < 2) {
    return {
      type: 'keep',
      reason:
        totalHanzi === 0
          ? 'Không có chữ Hán (chỉ có Latin/số/ký tự thông thường)'
          : `Chỉ có ${totalHanzi} ký tự Hán, cần ít nhất 2 ký tự`,
      details: { hanzi_count: totalHanzi, has_sufficient_hanzi: false, is_clean: true },
    }
  }

  const laundryKw = nonempty
    .flatMap((b) => IMAGE_LOC_LAUNDRY_KEYWORDS.filter((k) => (b.text || '').includes(k)))
    .find(Boolean)
  if (laundryKw || hasLaundryCareContext(nonempty)) {
    return {
      type: 'gemini',
      reason: `Chứa từ khóa hướng dẫn giặt tẩy: ${laundryKw || 'laundry'} - ${totalHanzi} Hán tự`,
      details: { laundry_keyword: laundryKw || 'laundry', hanzi_count: totalHanzi, has_laundry_care: true },
    }
  }

  const ov = overlapRatio(nonempty)
  if (ov > 0.05) {
    return {
      type: 'gemini',
      reason: `Chữ Hán bị đè nghiêm trọng (${(ov * 100).toFixed(1)}% > 5%) - ${totalHanzi} Hán tự`,
      details: { overlap_ratio: ov, hanzi_count: totalHanzi, has_overlap: true },
    }
  }

  const complex = containsComplexKeyword(nonempty)
  if (complex) {
    return {
      type: 'gemini',
      reason: `Chứa nội dung phức tạp: ${complex} - ${totalHanzi} Hán tự`,
      details: { complex_keyword: complex, hanzi_count: totalHanzi },
    }
  }

  return {
    type: 'local',
    reason: `Ảnh nhiều chữ Hán thông thường (${nonempty.length} blocks, ${totalHanzi} Hán tự, không bị đè, không phức tạp)`,
    details: { text_blocks: nonempty.length, hanzi_count: totalHanzi, is_normal_chinese: true },
  }
}

export function localBlocksNeedDraw(
  blocks: ImageLocOcrBlock[],
  opts: { deleteSizeAndLaundry: boolean }
): { action: 'deleted' | 'empty' | 'draw'; blocks: ImageLocOcrBlock[]; message: string } {
  if (hasFactoryIntroContext(blocks)) {
    return { action: 'deleted', blocks: [], message: 'Xóa theo keyword cấm trong local translator' }
  }
  if (opts.deleteSizeAndLaundry && hasSizeTableContext(blocks)) {
    return { action: 'deleted', blocks: [], message: 'Xóa theo keyword cấm trong local translator' }
  }
  if (opts.deleteSizeAndLaundry && hasLaundryCareContext(blocks)) {
    return { action: 'deleted', blocks: [], message: 'Xóa theo keyword cấm trong local translator' }
  }
  for (const b of blocks) {
    const hit = urgentDeleteHit(b.text || '')
    if (hit) return { action: 'deleted', blocks: [], message: 'Xóa theo keyword cấm trong local translator' }
  }

  const draw: ImageLocOcrBlock[] = []
  for (const b of blocks) {
    const text = (b.text || '').trim()
    if (!text) continue
    const isDomain = IMAGE_LOC_DOMAIN_REGEX.test(text) || /www\.|\.com|\.cn|\.net|\.org|\.vn/i.test(text)
    const isOldYear = /2019|2020|2021|2022|2023|2024/.test(text)
    const hasJin = text.includes('斤')
    if (isDomain || isOldYear) {
      draw.push({ text: '', bbox: b.bbox })
      continue
    }
    if (hasJin || hasChineseText(text) || /^\d+(?:[.,]\d+)?\s*cm$/i.test(text)) {
      draw.push(b)
    }
  }
  if (!draw.length) return { action: 'empty', blocks: [], message: 'Không có block local cần xử lý' }
  return { action: 'draw', blocks: draw, message: 'OCR: DeepSeek dịch chữ + vẽ lại chữ lên ảnh (local)' }
}

export function convertJinWeightText(text: string): string {
  return text.replace(/(\d+(?:\.\d+)?)\s*斤/g, (_m, n) => {
    const kg = Math.round(Number(n) * 0.5 * 100) / 100
    return `${kg} kg`
  })
}
