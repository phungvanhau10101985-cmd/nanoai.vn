/**
 * Overlay dịch lên ảnh: xóa chữ cũ (cover bằng nền), vẽ chữ mới đã dịch.
 * Dùng cho hậu kiểm – dịch nốt những từ còn sót.
 */

import sharp from 'sharp'

export interface OverlayItem {
  bbox: { x: number; y: number; width: number; height: number }
  translatedText: string
  /** Xóa chữ/vùng cũ dù không có chữ thay thế (domain, năm cũ). */
  eraseOriginal?: boolean
  /** Vùng tô nền rộng hơn ô chữ, để phủ nét Hán OCR không đọc được trên cùng hàng. */
  eraseBox?: { x: number; y: number; width: number; height: number }
  /** Ô OCR trước khi nới thành ô bảng — dùng để không tô trắng phần ảnh nằm ngoài chữ. */
  sourceBbox?: { x: number; y: number; width: number; height: number }
}

function escapeSvgText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function surroundingBackgroundColor(
  imageBuffer: Buffer,
  box: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number
): Promise<[number, number, number]> {
  const pad = Math.max(5, Math.min(14, Math.trunc(0.18 * Math.max(box.width, box.height))))
  const left = Math.max(0, box.x - pad)
  const top = Math.max(0, box.y - pad)
  const right = Math.min(imageWidth, box.x + box.width + pad)
  const bottom = Math.min(imageHeight, box.y + box.height + pad)
  const extracted = await sharp(imageBuffer)
    .ensureAlpha()
    .extract({ left, top, width: right - left, height: bottom - top })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = extracted.info.channels
  const samples: number[][] = [[], [], []]
  const totalPixels = extracted.info.width * extracted.info.height
  const step = Math.max(1, Math.ceil(totalPixels / 50_000))
  for (let pixel = 0; pixel < totalPixels; pixel += step) {
    const px = pixel % extracted.info.width
    const py = Math.trunc(pixel / extracted.info.width)
    const inside =
      px >= box.x - left &&
      px < box.x - left + box.width &&
      py >= box.y - top &&
      py < box.y - top + box.height
    if (inside) continue
    for (let channel = 0; channel < 3; channel++) {
      samples[channel].push(extracted.data[pixel * channels + channel])
    }
  }
  return samples.map((values) => {
    if (!values.length) return 255
    values.sort((a, b) => a - b)
    return values[Math.trunc(values.length / 2)]
  }) as [number, number, number]
}

async function interiorFillColor(
  imageBuffer: Buffer,
  box: { x: number; y: number; width: number; height: number }
): Promise<[number, number, number]> {
  const left = Math.max(0, Math.round(box.x))
  const top = Math.max(0, Math.round(box.y))
  const extracted = await sharp(imageBuffer)
    .extract({
      left,
      top,
      width: Math.max(1, Math.round(box.width)),
      height: Math.max(1, Math.round(box.height)),
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = extracted.info.channels
  const kept: number[][] = [[], [], []]
  const all: number[][] = [[], [], []]
  const total = extracted.info.width * extracted.info.height
  const step = Math.max(1, Math.ceil(total / 40_000))
  for (let pixel = 0; pixel < total; pixel += step) {
    const rgb = [0, 1, 2].map((channel) => extracted.data[pixel * channels + channel])
    const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
    for (let channel = 0; channel < 3; channel++) all[channel].push(rgb[channel])
    if (luminance < 210) {
      for (let channel = 0; channel < 3; channel++) kept[channel].push(rgb[channel])
    }
  }
  const source = kept[0].length >= 20 ? kept : all
  return source.map((values) => {
    if (!values.length) return 255
    values.sort((a, b) => a - b)
    return values[Math.trunc(values.length / 2)]
  }) as [number, number, number]
}

function clusterSortedEdges(values: number[], gap: number): number[][] {
  if (!values.length) return []
  const sorted = [...values].sort((a, b) => a - b)
  const groups: number[][] = [[sorted[0]]]
  for (const value of sorted.slice(1)) {
    const group = groups[groups.length - 1]
    if (value - group[group.length - 1] <= gap) group.push(value)
    else groups.push([value])
  }
  return groups
}

/** Poster điểm nổi bật có ảnh sản phẩm xen giữa các dải chữ. Bảng size thì các hàng sát nhau. */
export function overlayTextRowsHavePhotoGap(items: Array<{ bbox: { y: number } }>): boolean {
  if (items.length < 4) return false
  const rows = clusterSortedEdges(
    items.map((item) => item.bbox.y),
    18
  )
  if (rows.length < 2) return false
  const centers = rows
    .map((group) => group.reduce((sum, value) => sum + value, 0) / group.length)
    .sort((a, b) => a - b)
  const gaps = centers.slice(1).map((value, index) => value - centers[index]!)
  return gaps.length > 0 && Math.max(...gaps) >= 150
}

/** Nhiều hàng × ít nhất hai cột: bảng thông số. Không phóng chữ ra hàng bên dưới. */
export function overlayItemsLookLikeTable(items: Array<{ bbox: { x: number; y: number } }>): boolean {
  if (items.length < 6) return false
  if (overlayTextRowsHavePhotoGap(items)) return false
  const columns = clusterSortedEdges(
    items.map((item) => item.bbox.x),
    28
  ).filter((group) => group.length >= 3)
  const rows = clusterSortedEdges(
    items.map((item) => item.bbox.y),
    14
  )
  return columns.length >= 2 && rows.length >= 4
}

function wrapOverlayWords(text: string, maxChars: number): string[] {
  const lines: string[] = []
  for (const part of text.split('\n')) {
    const words = part.trim().split(/\s+/).filter(Boolean)
    if (!words.length) continue
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (!current || candidate.length <= maxChars) current = candidate
      else {
        lines.push(current)
        current = word
      }
    }
    if (current) lines.push(current)
  }
  return lines.length ? lines : ['']
}

/** Slogan một dải ở mép ảnh (banner dưới / trên), không phải bảng thông số. */
export function overlayItemLooksLikeEdgeBanner(
  item: { bbox: { x: number; y: number; width: number; height: number } },
  imageWidth: number,
  imageHeight: number
): boolean {
  const { y, width, height } = item.bbox
  if (imageWidth < 1 || imageHeight < 1) return false
  if (width < imageWidth * 0.45) return false
  if (height < 8 || height > imageHeight * 0.22) return false
  const bottom = y + height
  return y <= imageHeight * 0.2 || bottom >= imageHeight * 0.78
}

/**
 * Dải slogan dừng trước tem mã (2W31) nằm cùng hàng.
 * Không phóng cao — phóng sẽ đè sản phẩm và tem vàng.
 */
export function clipEdgeBannerBox(
  item: OverlayItem,
  obstacles: OverlayItem[],
  imageWidth: number,
  imageHeight: number
): { x: number; y: number; width: number; height: number } {
  const box = item.bbox
  let x2 = box.x + box.width
  const bandTop = box.y - box.height * 0.85
  const bandBottom = box.y + box.height + 2
  for (const other of obstacles) {
    if (other === item) continue
    const oy1 = other.bbox.y
    const oy2 = other.bbox.y + other.bbox.height
    if (oy2 < bandTop || oy1 > bandBottom) continue
    if (other.bbox.x < box.x + Math.max(48, box.width * 0.28)) continue
    x2 = Math.min(x2, other.bbox.x - 8)
  }
  const x = box.x <= 48 ? 0 : Math.max(0, Math.round(box.x) - 12)
  let y = Math.max(0, Math.round(box.y) - 2)
  let bottom = Math.round(box.y + box.height)
  if (bottom >= imageHeight * 0.9) bottom = imageHeight
  bottom = Math.min(imageHeight, Math.max(y + 1, bottom))
  x2 = Math.max(x + 48, Math.min(imageWidth - 2, x2))
  return {
    x,
    y,
    width: Math.max(1, Math.min(imageWidth - x, Math.round(x2 - x))),
    height: bottom - y,
  }
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
}

/** Dải slogan dừng tại chỗ màu đổi sang tem (vàng), không đè chữ mã. */
export async function snapBannerClearOfBadge(
  imageBuffer: Buffer,
  box: { x: number; y: number; width: number; height: number },
  imageWidth: number
): Promise<{ x: number; y: number; width: number; height: number }> {
  const left = Math.max(0, Math.round(box.x))
  const width = Math.max(1, Math.min(imageWidth - left, Math.round(box.width)))
  const top = Math.max(0, Math.round(box.y + box.height * 0.35))
  const rowH = Math.max(3, Math.min(Math.round(box.height * 0.3), Math.round(box.height)))
  const extracted = await sharp(imageBuffer)
    .extract({ left, top, width, height: rowH })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = extracted.info.channels
  const cols: Array<[number, number, number]> = []
  for (let x = 0; x < extracted.info.width; x++) {
    const samples: number[][] = [[], [], []]
    for (let y = 0; y < extracted.info.height; y++) {
      const pixel = y * extracted.info.width + x
      for (let channel = 0; channel < 3; channel++) samples[channel].push(extracted.data[pixel * channels + channel])
    }
    cols.push(
      samples.map((values) => {
        values.sort((a, b) => a - b)
        return values[Math.trunc(values.length / 2)]
      }) as [number, number, number]
    )
  }
  const probe = cols.slice(0, Math.max(8, Math.floor(cols.length * 0.22))).filter((rgb) => {
    const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
    return luminance < 210
  })
  if (probe.length < 4) return { ...box, x: left, width }
  const fill = probe
    .reduce(
      (sum, rgb) => [sum[0] + rgb[0], sum[1] + rgb[1], sum[2] + rgb[2]] as [number, number, number],
      [0, 0, 0] as [number, number, number]
    )
    .map((value) => Math.round(value / probe.length)) as [number, number, number]
  let edge = cols.length
  let run = 0
  for (let x = cols.length - 1; x > cols.length * 0.35; x--) {
    if (colorDistance(cols[x], fill) > 70) {
      run += 1
      edge = x
    } else if (run >= 8) break
    else run = 0
  }
  if (run < 8) return { ...box, x: left, width }
  const snapped = Math.max(left + 48, left + edge - 6)
  return { ...box, x: left, width: Math.max(1, snapped - left) }
}

export function fitBannerText(text: string, width: number, height: number) {
  const padX = Math.max(8, Math.min(18, Math.round(width * 0.03)))
  const innerW = Math.max(20, width - padX * 2)
  const innerH = Math.max(12, height - 8)
  let font = Math.min(34, Math.floor(innerH * 0.72))
  let lines = wrapOverlayWords(text, 80)
  let lineHeight = Math.round(font * 1.12)
  for (; font >= 13; font -= 1) {
    const maxChars = Math.max(4, Math.floor(innerW / (font * 0.52)))
    const wrapped = wrapOverlayWords(text, maxChars)
    lineHeight = Math.round(font * 1.12)
    if (wrapped.length <= 2 && wrapped.length * lineHeight <= innerH) {
      lines = wrapped
      break
    }
  }
  if (font < 13) {
    font = 13
    lineHeight = Math.round(font * 1.12)
    const maxChars = Math.max(4, Math.floor(innerW / (font * 0.52)))
    lines = wrapOverlayWords(text, maxChars).slice(0, 2)
  }
  return { lines, fontSize: font, lineHeight, padX }
}

/** Bỏ mã model mà bản dịch tự thêm ở đầu, khi câu gốc không có mã đó. */
export function stripInventedLeadingModelCode(source: string, translated: string): string {
  const cleaned = translated.trim()
  const match = cleaned.match(/^([A-Z0-9][A-Z0-9-]{2,11})\s+([\s\S]+)$/i)
  if (!match) return cleaned
  const code = match[1]
  if (!/\d/.test(code) || !/[A-Za-z]/.test(code)) return cleaned
  if (source.toLowerCase().includes(code.toLowerCase())) return cleaned
  return match[2].trim()
}

/** Mã model dính cuối dòng chữ Hán (`…创造50GBN`) tách ra, không dịch vào slogan. */
export function splitTrailingModelCode(text: string): { text: string; code: string } {
  const trimmed = text.trim()
  const match = trimmed.match(/^(.*?)([A-Za-z]{0,4}\d[A-Za-z0-9]{1,10})$/)
  if (!match) return { text: trimmed, code: '' }
  const body = match[1].replace(/[\s,，、]+$/g, '').trim()
  const code = match[2]
  if (!body || !/[\u4e00-\u9fff]/.test(body)) return { text: trimmed, code: '' }
  if (!/[A-Za-z]/.test(code) || !/\d/.test(code)) return { text: trimmed, code: '' }
  if (code.length < 4 || code.length > 12) return { text: trimmed, code: '' }
  return { text: body, code }
}

/** Tách dòng OCR dính sau IP65 và thêm khoảng trắng sau dấu câu trong ô thông số. */
export function spaceSpecPunctuation(text: string): string {
  if (!/\d/.test(text)) return text
  return text
    .replace(/[˙•]+$/g, '')
    .replace(/IP65(?=[A-Za-z])/g, 'IP65\n')
    .replace(/\s*:\s*/g, ': ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function isCompactLabel(item: OverlayItem): boolean {
  const text = (item.translatedText || '').trim()
  if (!text || item.eraseOriginal) return false
  if (item.bbox.width > 110) return false
  if (/\d{2,}/.test(text)) return false
  return [...text].length <= 18
}

/** Số đo dính sát bên phải nhãn (`胸围` + `82cm`), không phải ô số của hàng dưới. */
export function isTrailingMeasurement(text: string): boolean {
  const value = text.trim()
  if (!value || value.length > 28 || /[\u4e00-\u9fff]/.test(value)) return false
  if (!/\d/.test(value)) return false
  return /cm|mm|kg|ml|%/i.test(value) || /^[~±]?\d[\d./~\s-]*$/.test(value)
}

/** Gộp nhãn với số đo ngay bên phải để «Vòng ngực 82cm» nằm một dòng, không cắt giữa chữ. */
export function attachTrailingMeasurements<T extends OverlayItem>(
  items: T[],
  obstacles: OverlayItem[]
): { items: T[]; obstacles: OverlayItem[] } {
  const consumed = new Set<OverlayItem>()
  const nextItems = items.map((item) => {
    const itemRight = item.bbox.x + item.bbox.width
    const centerY = item.bbox.y + item.bbox.height / 2
    const measure = obstacles
      .filter((other) => {
        if (consumed.has(other) || !isTrailingMeasurement(other.translatedText)) return false
        const gap = other.bbox.x - itemRight
        if (gap < -4 || gap > 16) return false
        const otherCenter = other.bbox.y + other.bbox.height / 2
        return Math.abs(otherCenter - centerY) <= Math.max(item.bbox.height, other.bbox.height, 14)
      })
      .sort((a, b) => a.bbox.x - b.bbox.x)[0]
    if (!measure) return item
    consumed.add(measure)
    const top = Math.min(item.bbox.y, measure.bbox.y)
    const bottom = Math.max(item.bbox.y + item.bbox.height, measure.bbox.y + measure.bbox.height)
    const right = measure.bbox.x + measure.bbox.width
    const measureText = measure.translatedText.trim()
    const label = item.translatedText.trim()
    const translatedText = label.includes(measureText) ? label : `${label} ${measureText}`.trim()
    return {
      ...item,
      translatedText,
      bbox: {
        x: item.bbox.x,
        y: top,
        width: Math.max(1, right - item.bbox.x),
        height: Math.max(1, bottom - top),
      },
    }
  })
  return { items: nextItems, obstacles: obstacles.filter((item) => !consumed.has(item)) }
}

/**
 * Nới ô chữ Hán ra hết cột / hết hàng, dừng trước ô bên cạnh.
 * Chữ Việt dài hơn vẫn nằm trong ô bảng, không cắt cụt giữa từ.
 */
export function expandTableCellBoxes<T extends OverlayItem>(
  items: T[],
  imageWidth: number,
  obstacles: OverlayItem[] = []
): T[] {
  void imageWidth
  if (!overlayItemsLookLikeTable(items)) return items
  const pool = obstacles.length ? [...items, ...obstacles] : items
  const expanded = items.map((item) => {
    const contained = pool.filter((other) => {
      if (other === item) return false
      const cx = other.bbox.x + other.bbox.width / 2
      const cy = other.bbox.y + other.bbox.height / 2
      const inside =
        cx > item.bbox.x + 2 &&
        cx < item.bbox.x + item.bbox.width - 2 &&
        cy > item.bbox.y + 2 &&
        cy < item.bbox.y + item.bbox.height - 2
      return inside && other.bbox.width * other.bbox.height < item.bbox.width * item.bbox.height * 0.5
    })
    const sourceBbox = item.sourceBbox ?? { ...item.bbox }
    if (contained.length >= 2) return { ...item, translatedText: '', eraseOriginal: true, sourceBbox }
    const centerY = item.bbox.y + item.bbox.height / 2
    const itemRight = item.bbox.x + item.bbox.width
    const itemBottom = item.bbox.y + item.bbox.height
    const lineH = Math.max(12, item.bbox.height)
    const maxVGap = Math.max(36, Math.trunc(lineH * 1.6))
    const toTheRight = pool
      .filter((other) => {
        if (other === item || other.bbox.x < itemRight - 4) return false
        const otherCenter = other.bbox.y + other.bbox.height / 2
        return Math.abs(otherCenter - centerY) <= Math.max(lineH, other.bbox.height, 18)
      })
      .sort((a, b) => a.bbox.x - b.bbox.x)[0]
    const below = pool
      .filter((other) => {
        if (other === item || other.bbox.y < itemBottom - 2) return false
        if (other.bbox.y - itemBottom > maxVGap) return false
        const overlap =
          Math.min(itemRight, other.bbox.x + other.bbox.width) - Math.max(item.bbox.x, other.bbox.x)
        return overlap > 4
      })
      .sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x)[0]
    let x2 = toTheRight ? toTheRight.bbox.x - 8 : itemRight
    if (toTheRight && isCompactLabel(item) && isCompactLabel(toTheRight)) {
      const gap = toTheRight.bbox.x - itemRight
      if (gap > 36) x2 = Math.min(x2, itemRight + Math.floor(gap / 2))
    }
    let y2 = below ? below.bbox.y - 4 : itemBottom
    if (!below) {
      const beside = pool.filter((other) => {
        if (other === item || other.bbox.x < itemRight - 4) return false
        const otherMid = other.bbox.y + other.bbox.height / 2
        return Math.abs(otherMid - centerY) <= Math.max(item.bbox.height, other.bbox.height, 14)
      })
      if (beside.length) {
        y2 = Math.max(y2, ...beside.map((other) => other.bbox.y + other.bbox.height))
      }
    }
    for (const other of pool) {
      if (other === item) continue
      const cx = other.bbox.x + other.bbox.width / 2
      const cy = other.bbox.y + other.bbox.height / 2
      if (cx <= item.bbox.x + 6 || cx >= x2 || cy <= item.bbox.y + 6 || cy >= y2) continue
      if (other.bbox.y >= item.bbox.y + 4) y2 = Math.min(y2, other.bbox.y - 2)
      else if (other.bbox.x >= item.bbox.x + 4) x2 = Math.min(x2, other.bbox.x - 2)
    }
    x2 = Math.max(item.bbox.x + item.bbox.width, x2)
    y2 = Math.max(item.bbox.y + item.bbox.height, y2)
    if (below) y2 = Math.min(y2, below.bbox.y - 2)
    return {
      ...item,
      sourceBbox,
      bbox: {
        x: item.bbox.x,
        y: item.bbox.y,
        width: Math.max(1, x2 - item.bbox.x),
        height: Math.max(1, y2 - item.bbox.y),
      },
    }
  })
  return expanded.map((item) => {
    if (!isCompactLabel(item)) return item
    const centerY = item.bbox.y + item.bbox.height / 2
    const leftSibling = expanded.some((other) => {
      if (other === item || !isCompactLabel(other)) return false
      if (other.bbox.x + other.bbox.width > item.bbox.x + 6) return false
      const otherCenter = other.bbox.y + other.bbox.height / 2
      return Math.abs(otherCenter - centerY) <= 14
    })
    if (leftSibling) return item
    const title = expanded
      .filter((other) => {
        if (other === item || !isCompactLabel(other) || other.bbox.x > item.bbox.x + 4) return false
        const titleBottom = other.bbox.y + other.bbox.height
        return titleBottom <= item.bbox.y + 2 && item.bbox.y - titleBottom <= 24
      })
      .sort((a, b) => b.bbox.y - a.bbox.y)[0]
    if (!title || title.bbox.x >= item.bbox.x - 8) return item
    const y = Math.max(0, item.bbox.y - 1)
    const right = item.bbox.x + item.bbox.width
    return {
      ...item,
      eraseBox: {
        x: title.bbox.x,
        y,
        width: Math.max(1, right - title.bbox.x),
        height: Math.max(1, item.bbox.y + item.bbox.height + 2 - y),
      },
    }
  })
}

function textWidthAt(fontSize: number, line: string): number {
  return [...line].length * fontSize * 0.56
}

/** Co cỡ chữ để cả cụm nằm trong ô, không cắt giữa một từ. */
export function fitTableCellText(
  text: string,
  width: number,
  height: number
): { fontSize: number; lines: string[]; lineHeight: number; padX: number } {
  text = spaceSpecPunctuation(text)
  const padX = width >= 80 ? 4 : 1
  const innerW = Math.max(8, width - padX * 2)
  const innerH = Math.max(8, height - 2)
  const parts = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const single = parts.length <= 1
  if (single) {
    for (let fontSize = Math.min(14, innerH); fontSize >= 6; fontSize--) {
      if (textWidthAt(fontSize, text) <= innerW + 1) {
        return { fontSize, lines: [text], lineHeight: Math.max(fontSize, Math.round(fontSize * 1.05)), padX }
      }
    }
  }
  for (let fontSize = Math.min(13, innerH); fontSize >= 6; fontSize--) {
    const maxChars = Math.max(1, Math.floor(innerW / (fontSize * 0.56)))
    const lines = parts.length > 1 ? parts : wrapOverlayWords(text, maxChars)
    const lineHeight = Math.max(fontSize, Math.round(fontSize * 1.12))
    const widest = Math.max(...lines.map((line) => textWidthAt(fontSize, line)))
    if (widest <= innerW + 1 && lines.length * lineHeight <= innerH + 1) {
      return { fontSize, lines, lineHeight, padX }
    }
  }
  const fontSize = 6
  const lineHeight = Math.round(fontSize * 1.12)
  const maxChars = Math.max(1, Math.floor(innerW / (fontSize * 0.56)))
  const wrapped = parts.length > 1 ? parts : wrapOverlayWords(text, maxChars)
  const maxLines = Math.max(1, Math.floor(innerH / lineHeight))
  const lines = wrapped.slice(0, maxLines).map((line) => clipLineToWidth(line, fontSize, innerW))
  return { fontSize, lines: lines.length ? lines : [''], lineHeight, padX }
}

function clipLineToWidth(line: string, fontSize: number, innerW: number): string {
  if (textWidthAt(fontSize, line) <= innerW + 1) return line
  let out = ''
  for (const ch of line) {
    if (textWidthAt(fontSize, out + ch) > innerW) break
    out += ch
  }
  return out.trim() || [...line][0] || ''
}

function tableEraseBox(
  item: OverlayItem,
  items: OverlayItem[],
  imageWidth: number,
  imageHeight: number
): { x: number; y: number; width: number; height: number } {
  const pad = 3
  let x1 = item.bbox.x - pad
  let y1 = item.bbox.y - pad
  let x2 = item.bbox.x + item.bbox.width + pad
  let y2 = item.bbox.y + item.bbox.height + pad
  for (const other of items) {
    if (other === item) continue
    const ox1 = other.bbox.x
    const oy1 = other.bbox.y
    const ox2 = other.bbox.x + other.bbox.width
    const oy2 = other.bbox.y + other.bbox.height
    const verticalOverlap = Math.min(y2, oy2) - Math.max(y1, oy1) > 0
    const horizontalOverlap = Math.min(x2, ox2) - Math.max(x1, ox1) > 0
    if (verticalOverlap && ox1 >= item.bbox.x + item.bbox.width - 2) x2 = Math.min(x2, ox1 - 1)
    if (verticalOverlap && ox2 <= item.bbox.x + 2) x1 = Math.max(x1, ox2 + 1)
    if (horizontalOverlap && oy1 >= item.bbox.y + item.bbox.height - 2) y2 = Math.min(y2, oy1 - 1)
    if (horizontalOverlap && oy2 <= item.bbox.y + 2) y1 = Math.max(y1, oy2 + 1)
  }
  x1 = Math.max(0, Math.round(x1))
  y1 = Math.max(0, Math.round(y1))
  x2 = Math.min(imageWidth, Math.round(x2))
  y2 = Math.min(imageHeight, Math.round(y2))
  return { x: x1, y: y1, width: Math.max(1, x2 - x1), height: Math.max(1, y2 - y1) }
}

function centeredTextBox(
  text: string,
  box: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number
) {
  if (!text) return box
  const x = Math.max(0, Math.min(imageWidth - 1, Math.round(box.x)))
  const y = Math.max(0, Math.min(imageHeight - 1, Math.round(box.y)))
  return {
    x,
    y,
    width: Math.max(1, Math.min(imageWidth - x, Math.round(box.width))),
    height: Math.max(1, Math.min(imageHeight - y, Math.round(box.height))),
  }
}

type PixelBox = { x: number; y: number; width: number; height: number }

function boxRemainder(outer: PixelBox, inner: PixelBox): PixelBox[] {
  const ox1 = outer.x
  const oy1 = outer.y
  const ox2 = outer.x + outer.width
  const oy2 = outer.y + outer.height
  let ix1 = Math.max(ox1, inner.x)
  let iy1 = Math.max(oy1, inner.y)
  let ix2 = Math.min(ox2, inner.x + inner.width)
  let iy2 = Math.min(oy2, inner.y + inner.height)
  if (ix2 <= ix1 || iy2 <= iy1) return [outer]
  const parts: PixelBox[] = []
  if (oy1 < iy1) parts.push({ x: ox1, y: oy1, width: ox2 - ox1, height: iy1 - oy1 })
  if (iy2 < oy2) parts.push({ x: ox1, y: iy2, width: ox2 - ox1, height: oy2 - iy2 })
  if (ox1 < ix1) parts.push({ x: ox1, y: iy1, width: ix1 - ox1, height: iy2 - iy1 })
  if (ix2 < ox2) parts.push({ x: ix2, y: iy1, width: ox2 - ix2, height: iy2 - iy1 })
  return parts
}

/** Da / kim loại: lệch kênh màu và nhiều xám giữa. Nền bảng trắng đen thì không. */
export async function overlayRegionIsProductPhoto(
  imageBuffer: Buffer,
  box: PixelBox,
  imageWidth: number,
  imageHeight: number
): Promise<boolean> {
  const left = Math.max(0, Math.min(imageWidth - 1, Math.round(box.x)))
  const top = Math.max(0, Math.min(imageHeight - 1, Math.round(box.y)))
  const width = Math.max(0, Math.min(imageWidth - left, Math.round(box.width)))
  const height = Math.max(0, Math.min(imageHeight - top, Math.round(box.height)))
  if (width < 8 || height < 8) return false
  const extracted = await sharp(imageBuffer)
    .extract({ left, top, width, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = extracted.info.channels
  const total = extracted.info.width * extracted.info.height
  if (total < 16) return false
  const step = Math.max(1, Math.ceil(total / 20_000))
  let sumRG = 0
  let sumGB = 0
  let sum = 0
  let sumSq = 0
  let mid = 0
  let n = 0
  for (let pixel = 0; pixel < total; pixel += step) {
    const offset = pixel * channels
    const r = extracted.data[offset]
    const g = extracted.data[offset + 1]
    const b = extracted.data[offset + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    sumRG += Math.abs(r - g)
    sumGB += Math.abs(g - b)
    sum += lum
    sumSq += lum * lum
    if (lum > 40 && lum < 215) mid += 1
    n += 1
  }
  if (n < 8) return false
  const colorSpread = (sumRG + sumGB) / n
  const mean = sum / n
  const std = Math.sqrt(Math.max(0, sumSq / n - mean * mean))
  if (colorSpread > 12 && std > 16) return true
  return std > 26 && mid / n > 0.4
}

async function tableExpansionCoversPhoto(
  imageBuffer: Buffer,
  items: OverlayItem[],
  imageWidth: number,
  imageHeight: number
): Promise<boolean> {
  for (const item of items) {
    const src = item.sourceBbox
    if (!src) continue
    const outer = item.eraseBox ?? item.bbox
    const parts = boxRemainder(outer, src)
    for (const part of parts) {
      if (await overlayRegionIsProductPhoto(imageBuffer, part, imageWidth, imageHeight)) return true
    }
  }
  return false
}

/**
 * Overlay các đoạn chữ đã dịch lên ảnh: cover vùng cũ bằng nền, vẽ chữ mới.
 */
export async function overlayTranslatedText(
  imageBuffer: Buffer,
  items: OverlayItem[],
  options?: { fillColor?: string; textColor?: string; sampleBackground?: boolean; obstacles?: OverlayItem[] }
): Promise<Buffer> {
  if (items.length === 0) return imageBuffer

  const backgrounds: Array<{ input: Buffer; top: number; left: number }> = []
  const texts: Array<{ input: Buffer; top: number; left: number }> = []
  const source = sharp(imageBuffer)
  const meta = await source.metadata()
  const imageWidth = meta.width || 0
  const imageHeight = meta.height || 0
  if (!imageWidth || !imageHeight) return imageBuffer

  let table = overlayItemsLookLikeTable(items)
  const obstacles = options?.obstacles ?? []
  let drawItems = table ? expandTableCellBoxes(items, imageWidth, obstacles) : items
  if (table && (await tableExpansionCoversPhoto(imageBuffer, drawItems, imageWidth, imageHeight))) {
    table = false
    drawItems = items
  }
  const eraseNeighbors = table ? [...drawItems, ...obstacles] : items
  for (const item of drawItems) {
    const { bbox, translatedText } = item
    const banner =
      !table && overlayItemLooksLikeEdgeBanner(item, imageWidth, imageHeight)
        ? await snapBannerClearOfBadge(
            imageBuffer,
            clipEdgeBannerBox(item, obstacles, imageWidth, imageHeight),
            imageWidth
          )
        : null
    const preset = item.eraseBox
    const fitted = preset
      ? {
          x: Math.max(0, Math.min(imageWidth - 1, Math.round(preset.x))),
          y: Math.max(0, Math.min(imageHeight - 1, Math.round(preset.y))),
          width: Math.max(1, Math.min(imageWidth - Math.max(0, Math.round(preset.x)), Math.round(preset.width))),
          height: Math.max(1, Math.min(imageHeight - Math.max(0, Math.round(preset.y)), Math.round(preset.height))),
        }
      : table
      ? tableEraseBox(item, eraseNeighbors, imageWidth, imageHeight)
      : banner || {
          x: Math.max(0, Math.min(imageWidth - 1, Math.round(bbox.x))),
          y: Math.max(0, Math.min(imageHeight - 1, Math.round(bbox.y))),
          width: 0,
          height: 0,
        }
    const locked = Boolean(table || banner || preset)
    const x = locked ? fitted.x : Math.max(0, Math.min(imageWidth - 1, Math.round(bbox.x)))
    const y = locked ? fitted.y : Math.max(0, Math.min(imageHeight - 1, Math.round(bbox.y)))
    const w = locked
      ? fitted.width
      : Math.max(1, Math.min(imageWidth - x, Math.round(bbox.width)))
    const h = locked
      ? fitted.height
      : Math.max(1, Math.min(imageHeight - y, Math.round(bbox.height)))
    if (!translatedText.trim() && !item.eraseOriginal) continue
    if (await overlayRegionIsProductPhoto(imageBuffer, { x, y, width: w, height: h }, imageWidth, imageHeight)) {
      continue
    }
    let fillColor = options?.fillColor ?? '#ffffff'
    let textColor = options?.textColor ?? '#000000'
    let strokeColor = '#ffffff'
    if (banner && options?.sampleBackground) {
      try {
        const rgb = await interiorFillColor(imageBuffer, { x, y, width: w, height: h })
        fillColor = `rgb(${rgb.join(',')})`
        const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
        textColor = luminance > 140 ? '#111827' : '#ffffff'
        strokeColor = textColor === '#ffffff' ? '#111827' : '#ffffff'
      } catch {
        /* fallback to configured colors */
      }
    } else if (options?.sampleBackground) {
      try {
        const rgb = await surroundingBackgroundColor(
          imageBuffer,
          { x, y, width: w, height: h },
          imageWidth,
          imageHeight
        )
        fillColor = `rgb(${rgb.join(',')})`
        const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
        textColor = luminance > 140 ? '#000000' : '#ffffff'
        strokeColor = luminance > 140 ? '#ffffff' : '#000000'
      } catch {
        /* fallback to configured colors */
      }
    }
    const background = Buffer.from(
      `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="100%" height="100%" fill="${fillColor}"/>
      </svg>`
    )
    backgrounds.push({ input: background, top: y, left: x })
    if (!translatedText.trim()) continue

    const bannerFit = banner ? fitBannerText(translatedText.trim(), banner.width, banner.height) : null
    const cell = table
      ? fitTableCellText(translatedText.trim(), Math.max(1, Math.round(bbox.width)), Math.max(1, Math.round(bbox.height)))
      : null
    const drawBox = banner
      ? banner
      : cell
      ? {
          x: Math.max(0, Math.min(imageWidth - 1, Math.round(bbox.x))),
          y: Math.max(0, Math.min(imageHeight - 1, Math.round(bbox.y))),
          width: Math.max(1, Math.min(imageWidth - Math.round(bbox.x), Math.round(bbox.width))),
          height: Math.max(1, Math.min(imageHeight - Math.round(bbox.y), Math.round(bbox.height))),
        }
      : centeredTextBox(
          translatedText.trim(),
          { x: Math.max(0, Math.round(bbox.x)), y: Math.max(0, Math.round(bbox.y)), width: Math.max(1, Math.round(bbox.width)), height: Math.max(1, Math.round(bbox.height)) },
          imageWidth,
          imageHeight
        )
    const rawWords = translatedText.trim().split(/\s+/).filter(Boolean)
    const maxChars = cell
      ? 0
      : Math.max(
          4,
          Math.floor(drawBox.width / Math.max(6, Math.min(18, drawBox.height * 0.28)))
        )
    const lines = bannerFit ? bannerFit.lines : cell ? cell.lines : []
    if (!cell && !bannerFit) {
      for (const word of rawWords) {
        const candidate = lines.length ? `${lines[lines.length - 1]} ${word}` : word
        if (candidate.length <= maxChars || !lines.length) {
          if (lines.length) lines[lines.length - 1] = candidate
          else lines.push(candidate)
        } else {
          lines.push(word)
        }
      }
    }
    const lineCount = Math.max(1, lines.length)
    const fontSize = bannerFit
      ? bannerFit.fontSize
      : cell
      ? cell.fontSize
      : Math.max(
          8,
          Math.min(
            140,
            Math.floor((drawBox.height * 0.78) / lineCount),
            Math.floor(drawBox.width / Math.max(1, maxChars * 0.52))
          )
        )
    const lineHeight = bannerFit
      ? bannerFit.lineHeight
      : cell
        ? cell.lineHeight
        : Math.max(9, Math.round(fontSize * 1.12))
    const blockHeight = lineHeight * lineCount
    const startY = bannerFit || cell
      ? Math.max(fontSize, Math.round((drawBox.height - blockHeight) / 2 + fontSize * 0.8))
      : Math.max(fontSize, Math.round((drawBox.height - lineHeight * lineCount) / 2 + fontSize))
    const anchorX = bannerFit ? bannerFit.padX : cell ? cell.padX : '50%'
    const tspans = (lines.length ? lines : translatedText.trim() ? [translatedText.trim()] : [])
      .map(
        (line, index) =>
          `<tspan x="${anchorX}" y="${startY + index * lineHeight}">${escapeSvgText(line)}</tspan>`
      )
      .join('')
    const fittedInBox = Boolean(cell || bannerFit)
    const strokeWidth = fittedInBox ? 0 : fontSize < 24 ? 1 : Math.min(3, Math.max(1, Math.round(fontSize * 0.05)))

    const svg = Buffer.from(
      `<svg width="${drawBox.width}" height="${drawBox.height}" xmlns="http://www.w3.org/2000/svg">
        <text text-anchor="${fittedInBox ? 'start' : 'middle'}" font-size="${fontSize}" font-family="Arial, sans-serif"
          fill="${textColor}" stroke="${fittedInBox ? 'none' : strokeColor}" stroke-width="${strokeWidth}"
          paint-order="stroke fill">${tspans}</text>
      </svg>`
    )
    const textPng = await sharp(svg)
      .resize(drawBox.width, drawBox.height, { fit: 'cover', position: 'left top' })
      .png()
      .toBuffer()

    texts.push({ input: textPng, top: drawBox.y, left: drawBox.x })
  }

  return sharp(imageBuffer)
    .composite([...backgrounds, ...texts])
    .png()
    .toBuffer()
}
