/**
 * Overlay dịch lên ảnh: xóa chữ cũ (cover bằng nền), vẽ chữ mới đã dịch.
 * Dùng cho hậu kiểm – dịch nốt những từ còn sót.
 */

import sharp from 'sharp'

const MIN_LOCALIZED_FONT_SIZE = 10

export interface OverlayItem {
  bbox: { x: number; y: number; width: number; height: number }
  translatedText: string
  /** Xóa chữ/vùng cũ dù không có chữ thay thế (domain, năm cũ). */
  eraseOriginal?: boolean
  /** Vùng tô nền rộng hơn ô chữ, để phủ nét Hán OCR không đọc được trên cùng hàng. */
  eraseBox?: { x: number; y: number; width: number; height: number }
  /** Ô OCR trước khi nới thành ô bảng — dùng để không tô trắng phần ảnh nằm ngoài chữ. */
  sourceBbox?: { x: number; y: number; width: number; height: number }
  /** Thẻ trắng đã tô chung một dải. Ô này chỉ vẽ chữ. */
  skipFill?: boolean
  /** Màu mực đã chốt theo nét gốc, kiểu 188. */
  drawInk?: string
  /** Nền đặc cùng màu panel (xanh, nâu, trắng), không lấy màu trang bên ngoài. */
  fillPaint?: string
  /** Cỡ và các dòng đã chốt. Nền vẽ đúng khối chữ này, không nới theo cột. */
  lockedFont?: number
  lockedLines?: string[]
  /** Bảng thông số một cột: chữ căn trái, cùng mép, không đè icon. */
  specRow?: boolean
  textAlign?: 'start' | 'middle'
  /** Tọa độ x tuyệt đối của mép trái chữ, dùng chung cho cả cột thông số. */
  textOriginX?: number
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

/** Màu của dải ngang chứa dòng chữ (thanh header xám), không lấy nền trắng phía dưới. */
async function sameBandFillColor(
  imageBuffer: Buffer,
  box: { x: number; y: number; width: number; height: number },
  imageWidth: number
): Promise<[number, number, number] | null> {
  const top = Math.max(0, Math.round(box.y))
  const height = Math.max(1, Math.round(box.height))
  const extracted = await sharp(imageBuffer)
    .extract({ left: 0, top, width: imageWidth, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = extracted.info.channels
  const samples: number[][] = [[], [], []]
  const x1 = Math.max(0, Math.round(box.x))
  const x2 = Math.min(imageWidth, Math.round(box.x + box.width))
  for (let y = 0; y < extracted.info.height; y++) {
    for (let x = 0; x < extracted.info.width; x++) {
      if (x >= x1 && x < x2) continue
      const offset = (y * extracted.info.width + x) * channels
      const lum = 0.299 * extracted.data[offset] + 0.587 * extracted.data[offset + 1] + 0.114 * extracted.data[offset + 2]
      if (lum < 210) continue
      for (let channel = 0; channel < 3; channel++) samples[channel].push(extracted.data[offset + channel])
    }
  }
  if (samples[0].length < 12) return null
  return samples.map((values) => {
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

/**
 * Tách ảnh thông tin (mẫu + thang đo + bảng size + giặt) thành từng cụm.
 * Một khoảng trống dọc lớn là ranh giới cụm, không phải một ô của cùng bảng.
 */
export function splitOverlayVerticalBands<T extends { bbox: { y: number; height: number } }>(items: T[]): T[][] {
  const sorted = [...items].sort((a, b) => a.bbox.y - b.bbox.y)
  const bands: T[][] = []
  let current: T[] = []
  for (const item of sorted) {
    if (current.length) {
      const previousBottom = Math.max(...current.map((entry) => entry.bbox.y + entry.bbox.height))
      if (item.bbox.y - previousBottom >= 32) {
        bands.push(current)
        current = []
      }
    }
    current.push(item)
  }
  if (current.length) bands.push(current)
  return bands
}

type PixelBox = { x: number; y: number; width: number; height: number }

/** Chữ dịch được nới khung nhưng phải dừng trước cụm chữ gốc bên phải và bên dưới. */
export function clampTextBoxToSources(
  box: PixelBox,
  source: PixelBox,
  items: Array<{ bbox: PixelBox }>,
  imageWidth: number,
  imageHeight: number
): PixelBox {
  let width = box.width
  let height = box.height
  const x = Math.max(0, Math.min(imageWidth - 1, box.x))
  const y = Math.max(0, Math.min(imageHeight - 1, box.y))
  for (const item of items) {
    const other = item.bbox
    if (other === source) continue
    const sameRow =
      Math.min(source.y + source.height, other.y + other.height) - Math.max(source.y, other.y) >
      Math.min(source.height, other.height) * 0.4
    if (sameRow && other.x >= source.x + source.width - 2) {
      width = Math.min(width, Math.max(source.width, other.x - 4 - x))
    }
    const below = other.y >= source.y + source.height - 2
    const horizontalOverlap = Math.min(x + width, other.x + other.width) - Math.max(x, other.x) > 4
    if (below && horizontalOverlap) {
      height = Math.min(height, Math.max(source.height, other.y - 3 - y))
    }
  }
  return {
    x,
    y,
    width: Math.max(1, Math.min(width, imageWidth - x)),
    height: Math.max(1, Math.min(height, imageHeight - y)),
  }
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
  const y = Math.max(0, Math.round(box.y) - 2)
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

function rgbCss(rgb: [number, number, number]): string {
  return `rgb(${rgb.map((channel) => Math.max(0, Math.min(255, Math.round(channel)))).join(',')})`
}

function medianChannel(values: number[]): number {
  if (!values.length) return 0
  const copy = [...values].sort((a, b) => a - b)
  return copy[Math.floor(copy.length / 2)] ?? 0
}

/** Mực gần đen thành đen, mực gần trắng thành trắng. Nâu, đỏ, xanh giữ nguyên. */
export function snapNeutralInk(ink: [number, number, number]): [number, number, number] {
  const chroma = Math.max(ink[0], ink[1], ink[2]) - Math.min(ink[0], ink[1], ink[2])
  const lum = 0.299 * ink[0] + 0.587 * ink[1] + 0.114 * ink[2]
  if (chroma > 36) return ink
  if (lum >= 176) return [255, 255, 255]
  if (lum <= 120) return [0, 0, 0]
  return ink
}

/** Lõi nét: phần tối nhất trên nền sáng, phần sáng nhất trên nền tối. Bỏ viền khử răng cưa. */
function inkStrokeCore(
  pixels: Array<[number, number, number]>,
  fillLum: number
): [number, number, number] {
  if (pixels.length < 8) return fillLum > 140 ? [0, 0, 0] : [255, 255, 255]
  const ranked = pixels
    .map((rgb) => ({ rgb, lum: 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] }))
    .sort((a, b) => a.lum - b.lum)
  const count = Math.max(1, Math.round(ranked.length * 0.22))
  const core = fillLum > 140 ? ranked.slice(0, count) : ranked.slice(-count)
  const median = (channel: number) => {
    const values = core.map((item) => item.rgb[channel]).sort((a, b) => a - b)
    return values[Math.floor(values.length / 2)] ?? 0
  }
  return snapNeutralInk([median(0), median(1), median(2)])
}

export type OverlayPaint = {
  fill: [number, number, number]
  ink: [number, number, number]
  /** Nền gần như một màu: hộp xanh, tem nâu, nền trắng. Không phải da/vải. */
  flat: boolean
}

/**
 * Tách mực và nền trong ô chữ. Viền ô là nền; pixel lệch màu viền là mực.
 * Lấy lõi nét, không lấy viền khử răng cưa. Nâu trên trắng và trắng trên xanh giữ màu.
 * Mực gần đen thành đen, mực gần trắng thành trắng.
 */
export async function sampleOverlayPaint(
  imageBuffer: Buffer,
  box: PixelBox,
  imageWidth: number,
  imageHeight: number
): Promise<OverlayPaint> {
  const left = Math.max(0, Math.min(imageWidth - 1, Math.round(box.x)))
  const top = Math.max(0, Math.min(imageHeight - 1, Math.round(box.y)))
  const width = Math.max(1, Math.min(imageWidth - left, Math.round(box.width)))
  const height = Math.max(1, Math.min(imageHeight - top, Math.round(box.height)))
  const extracted = await sharp(imageBuffer)
    .extract({ left, top, width, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = extracted.info.channels
  const rgbAt = (index: number): [number, number, number] => [
    extracted.data[index * channels],
    extracted.data[index * channels + 1],
    extracted.data[index * channels + 2],
  ]
  const edge: number[][] = [[], [], []]
  const total = width * height
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x > 1 && y > 1 && x < width - 2 && y < height - 2) continue
      const rgb = rgbAt(y * width + x)
      for (let channel = 0; channel < 3; channel++) edge[channel].push(rgb[channel])
    }
  }
  let prior = [0, 1, 2].map((channel) => medianChannel(edge[channel])) as [number, number, number]
  const split = (anchor: [number, number, number]) => {
    const fill: number[][] = [[], [], []]
    const ink: number[][] = [[], [], []]
    const inkPixels: Array<[number, number, number]> = []
    for (let index = 0; index < total; index++) {
      const rgb = rgbAt(index)
      const bucket = colorDistance(rgb, anchor) > 42 ? ink : fill
      for (let channel = 0; channel < 3; channel++) bucket[channel].push(rgb[channel])
      if (bucket === ink) inkPixels.push(rgb)
    }
    return { fill, ink, inkPixels }
  }
  let parts = split(prior)
  const inkRatio = parts.ink[0].length / Math.max(1, total)
  if (inkRatio < 0.04 || inkRatio > 0.82) {
    try {
      prior = await surroundingBackgroundColor(
        imageBuffer,
        { x: left, y: top, width, height },
        imageWidth,
        imageHeight
      )
      parts = split(prior)
    } catch {
      /* giữ màu viền */
    }
  }
  const fill = (
    parts.fill[0].length >= 8
      ? [0, 1, 2].map((channel) => medianChannel(parts.fill[channel]))
      : prior
  ) as [number, number, number]
  const fillLum = 0.299 * fill[0] + 0.587 * fill[1] + 0.114 * fill[2]
  const ink = inkStrokeCore(parts.inkPixels, fillLum)
  let fillMean = 0
  let fillSq = 0
  const fillCount = Math.max(1, parts.fill[0].length)
  for (let index = 0; index < parts.fill[0].length; index++) {
    const lum = 0.299 * parts.fill[0][index] + 0.587 * parts.fill[1][index] + 0.114 * parts.fill[2][index]
    fillMean += lum
    fillSq += lum * lum
  }
  fillMean /= fillCount
  const fillStd = Math.sqrt(Math.max(0, fillSq / fillCount - fillMean * fillMean))
  const inkLum = 0.299 * ink[0] + 0.587 * ink[1] + 0.114 * ink[2]
  return {
    fill,
    ink,
    flat: fillStd < 22 && Math.abs(inkLum - fillLum) > 35,
  }
}

/**
 * Kéo ô OCR tới nét chữ bị cắt (đuôi nét, gạch dưới).
 * Cột đặc một màu là vải/áo, không nuốt vào.
 */
export async function expandBoxToGlyphs(
  imageBuffer: Buffer,
  box: PixelBox,
  paint: OverlayPaint,
  imageWidth: number,
  imageHeight: number
): Promise<PixelBox> {
  const padX = 6
  const padTop = 4
  const padBottom = 22
  const left0 = Math.max(0, Math.round(box.x) - padX)
  const top0 = Math.max(0, Math.round(box.y) - padTop)
  const right0 = Math.min(imageWidth, Math.round(box.x + box.width) + padX)
  const bottom0 = Math.min(imageHeight, Math.round(box.y + box.height) + padBottom)
  const width = Math.max(1, right0 - left0)
  const height = Math.max(1, bottom0 - top0)
  const extracted = await sharp(imageBuffer)
    .extract({ left: left0, top: top0, width, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = extracted.info.channels
  const fillLum = 0.299 * paint.fill[0] + 0.587 * paint.fill[1] + 0.114 * paint.fill[2]
  const isInk = (x: number, y: number) => {
    const offset = (y * width + x) * channels
    const rgb: [number, number, number] = [
      extracted.data[offset],
      extracted.data[offset + 1],
      extracted.data[offset + 2],
    ]
    const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
    return Math.abs(lum - fillLum) > 26 && colorDistance(rgb, paint.fill) > 28
  }
  let left = Math.max(0, Math.round(box.x) - left0)
  let right = Math.min(width, left + Math.max(1, Math.round(box.width)))
  let top = Math.max(0, Math.round(box.y) - top0)
  let bottom = Math.min(height, top + Math.max(1, Math.round(box.height)))
  const rowRatio = (y: number, x1: number, x2: number) => {
    let ink = 0
    let total = 0
    for (let x = x1; x < x2; x++) {
      total += 1
      if (isInk(x, y)) ink += 1
    }
    return total ? ink / total : 0
  }
  const glyphRow = (y: number) => {
    const ratio = rowRatio(y, Math.max(0, left), Math.min(width, right))
    return ratio >= 0.02 && ratio <= 0.62
  }
  for (let y = top - 1; y >= 0; y--) {
    if (!glyphRow(y)) break
    top = y
  }
  let missed = 0
  for (let y = bottom; y < height; y++) {
    if (!glyphRow(y)) {
      missed += 1
      if (missed > 16) break
      continue
    }
    missed = 0
    bottom = y + 1
  }
  const colRatio = (x: number) => {
    let ink = 0
    const span = Math.max(1, bottom - top)
    for (let y = top; y < bottom; y++) if (isInk(x, y)) ink += 1
    return ink / span
  }
  for (let x = left - 1; x >= 0; x--) {
    const ratio = colRatio(x)
    if (ratio < 0.04 || ratio > 0.62) break
    left = x
  }
  for (let x = right; x < width; x++) {
    const ratio = colRatio(x)
    if (ratio < 0.04 || ratio > 0.62) break
    right = x + 1
  }
  return {
    x: left0 + left,
    y: top0 + top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  }
}

/** Nới ngang trong cùng một màu nền. Dừng trước áo/tem màu khác và trước dòng chữ kế. */
export async function widenAlongFill(
  imageBuffer: Buffer,
  box: PixelBox,
  fill: [number, number, number],
  neighbors: PixelBox[],
  imageWidth: number,
  imageHeight: number,
  minWidth: number
): Promise<PixelBox> {
  const y = Math.max(0, Math.min(imageHeight - 1, Math.round(box.y)))
  const height = Math.max(1, Math.min(imageHeight - y, Math.round(box.height)))
  let left = Math.max(0, Math.round(box.x))
  let right = Math.min(imageWidth, left + Math.max(1, Math.round(box.width)))
  const row = await sharp(imageBuffer)
    .extract({ left: 0, top: y, width: imageWidth, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = row.info.channels
  const stripMatches = (x1: number, x2: number) => {
    const samples: number[][] = [[], [], []]
    for (let x = x1; x < x2; x += 1) {
      for (let yy = 0; yy < height; yy += Math.max(1, Math.floor(height / 3))) {
        const offset = (yy * imageWidth + x) * channels
        samples[0].push(row.data[offset])
        samples[1].push(row.data[offset + 1])
        samples[2].push(row.data[offset + 2])
      }
    }
    if (!samples[0].length) return false
    const rgb = [0, 1, 2].map((channel) => medianChannel(samples[channel])) as [number, number, number]
    return colorDistance(rgb, fill) <= 48
  }
  const hitsNeighbor = (x1: number, x2: number) =>
    neighbors.some((other) => {
      const overlapY = Math.min(y + height, other.y + other.height) - Math.max(y, other.y)
      if (overlapY <= 1) return false
      return x2 > other.x + 2 && x1 < other.x + other.width - 2
    })
  const needWidth = Math.max(right - left, minWidth)
  while (right + 4 <= imageWidth && right - left < needWidth) {
    if (hitsNeighbor(right, right + 4) || !stripMatches(right, Math.min(imageWidth, right + 4))) break
    right += 4
  }
  while (left - 4 >= 0 && right - left < needWidth) {
    if (hitsNeighbor(left - 4, left) || !stripMatches(Math.max(0, left - 4), left)) break
    left -= 4
  }
  return { x: left, y, width: Math.max(1, right - left), height }
}

/** Nới cao trong cùng màu nền để chữ đủ cỡ đọc. Dừng trước dòng kế và trước nét vẽ. */
export async function growBoxAlongFill(
  imageBuffer: Buffer,
  box: PixelBox,
  fill: [number, number, number],
  neighbors: PixelBox[],
  imageWidth: number,
  imageHeight: number,
  minHeight: number
): Promise<PixelBox> {
  const left = Math.max(0, Math.round(box.x))
  const width = Math.max(1, Math.min(imageWidth - left, Math.round(box.width)))
  const originTop = Math.max(0, Math.round(box.y))
  const originBottom = Math.min(imageHeight, originTop + Math.max(1, Math.round(box.height)))
  const want = Math.max(originBottom - originTop, Math.round(minHeight))
  const capTop = Math.max(0, originTop - 40)
  const capBottom = Math.min(imageHeight, originBottom + 56)
  const scanHeight = Math.max(1, capBottom - capTop)
  const extracted = await sharp(imageBuffer)
    .extract({ left, top: capTop, width, height: scanHeight })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = extracted.info.channels
  const rowOk = (y: number, rowHeight: number) => {
    const samples: number[][] = [[], [], []]
    let contrast = 0
    let count = 0
    for (let yy = y; yy < y + rowHeight && yy < capBottom; yy++) {
      const localY = yy - capTop
      if (localY < 0 || localY >= scanHeight) return false
      for (let x = 0; x < width; x += 2) {
        const offset = (localY * width + x) * channels
        const rgb: [number, number, number] = [
          extracted.data[offset],
          extracted.data[offset + 1],
          extracted.data[offset + 2],
        ]
        if (colorDistance(rgb, fill) > 48) contrast += 1
        samples[0].push(rgb[0])
        samples[1].push(rgb[1])
        samples[2].push(rgb[2])
        count += 1
      }
    }
    if (!count) return false
    if (contrast / count > 0.08) return false
    const rgb = [0, 1, 2].map((channel) => medianChannel(samples[channel])) as [number, number, number]
    return colorDistance(rgb, fill) <= 48
  }
  const hitsNeighbor = (y1: number, y2: number) =>
    neighbors.some((other) => {
      const overlapX = Math.min(left + width, other.x + other.width) - Math.max(left, other.x)
      if (overlapX < 8) return false
      return y2 > other.y + 2 && y1 < other.y + other.height - 2
    })
  let top = originTop
  let bottom = originBottom
  while (bottom - top < want && bottom + 4 <= capBottom) {
    if (hitsNeighbor(bottom, bottom + 4) || !rowOk(bottom, 4)) break
    bottom += 4
  }
  while (bottom - top < want && top - 4 >= capTop) {
    if (hitsNeighbor(top - 4, top) || !rowOk(top - 4, 4)) break
    top -= 4
  }
  return { x: left, y: top, width, height: Math.max(1, bottom - top) }
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
    if (toTheRight) {
      const gap = toTheRight.bbox.x - itemRight
      const compactGap = isCompactLabel(item) && isCompactLabel(toTheRight) && gap > 36
      if (compactGap || gap > 96) x2 = Math.min(x2, itemRight + Math.floor(gap / 2))
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
  // Arial tiếng Việt trung bình gần 0,5em; 0,56 làm co chữ xuống dưới ngưỡng
  // đọc được dù chuỗi thực tế vẫn vừa ô.
  return [...line].length * fontSize * 0.5
}

/** Bề rộng Arial khi vẽ thật. Rộng hơn ước lượng co chữ, để không cắt «SHOW». */
function paintLineWidth(fontSize: number, line: string): number {
  return [...line].length * fontSize * 0.62
}

/**
 * Cỡ đọc được khi ảnh phóng hết chiều ngang điện thoại 390px.
 * 14px trên màn đó; ảnh rộng hơn thì nhân theo tỷ lệ.
 */
export function mobileReadableFontSize(imageWidth: number): number {
  return Math.max(14, Math.round((Math.max(1, imageWidth) * 14) / 390))
}

/** Sàn cỡ chữ dịch. Thu ảnh về rộng 390 thì nét còn khoảng 15px, không co về 8px. */
export function readableOverlayFont(imageWidth: number): number {
  const scaled = Math.round((Math.max(1, imageWidth) * 15) / 390)
  return Math.max(16, Math.min(30, scaled))
}

/** Nền khít chữ: rộng bằng dòng dài nhất, cao bằng số dòng, chỉ chừa 4px cho nét. */
export function fitTextPlate(
  text: string,
  column: PixelBox,
  fontSize: number
): { x: number; y: number; width: number; height: number; fontSize: number; lines: string[]; lineHeight: number } {
  const phrase = text.trim()
  const pad = 4
  const innerW = Math.max(8, column.width - pad * 2)
  const maxChars = Math.max(1, Math.floor(innerW / (fontSize * 0.5)))
  const lines = textWidthAt(fontSize, phrase) <= innerW ? [phrase] : wrapOverlayWords(phrase, maxChars)
  const lineHeight = Math.round(fontSize * 1.15)
  const widest = Math.max(1, ...lines.map((line) => textWidthAt(fontSize, line)))
  const plateW = Math.max(1, Math.min(column.width, Math.ceil(widest + pad * 2)))
  const plateH = Math.max(1, Math.ceil(lines.length * lineHeight + pad * 2))
  const x = Math.max(column.x, Math.round(column.x + (column.width - plateW) / 2))
  return { x, y: column.y, width: plateW, height: plateH, fontSize, lines, lineHeight }
}

/** Co cỡ chữ để cả cụm nằm trong ô, không cắt giữa một từ. */
export function fitTableCellText(
  text: string,
  width: number,
  height: number,
  maxFont = 14
): { fontSize: number; lines: string[]; lineHeight: number; padX: number } {
  text = spaceSpecPunctuation(text)
  const padX = width >= 80 ? 4 : 1
  const innerW = Math.max(8, width - padX * 2)
  const innerH = Math.max(8, height - 2)
  const parts = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const single = parts.length <= 1
  const cap = Math.max(MIN_LOCALIZED_FONT_SIZE, maxFont)
  const start = Math.max(MIN_LOCALIZED_FONT_SIZE, Math.min(cap, innerH))
  for (let fontSize = start; fontSize >= MIN_LOCALIZED_FONT_SIZE; fontSize--) {
    if (single && textWidthAt(fontSize, text) <= innerW + 1) {
      return { fontSize, lines: [text], lineHeight: Math.max(fontSize, Math.round(fontSize * 1.05)), padX }
    }
    const maxChars = Math.max(1, Math.floor(innerW / (fontSize * 0.5)))
    const lines = parts.length > 1 ? parts : wrapOverlayWords(text, maxChars)
    const lineHeight = Math.max(fontSize, Math.round(fontSize * 1.12))
    const widest = Math.max(...lines.map((line) => textWidthAt(fontSize, line)))
    if (lines.length > 1 && widest <= innerW + 1 && lines.length * lineHeight <= innerH + 1) {
      return { fontSize, lines, lineHeight, padX }
    }
  }
  const fontSize = MIN_LOCALIZED_FONT_SIZE
  const lineHeight = Math.round(fontSize * 1.12)
  const maxChars = Math.max(1, Math.floor(innerW / (fontSize * 0.5)))
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

/**
 * Câu dịch trên poster thường dài hơn câu Hán nhưng bbox OCR chỉ cao đúng một dòng.
 * Mở vùng vẽ (không mở vùng xóa nền) để giữ cỡ chữ tương đương ảnh 188/Gemini.
 */
export function fitPosterParagraphText(
  text: string,
  box: PixelBox,
  imageWidth: number,
  imageHeight: number
): { box: PixelBox; lines: string[]; fontSize: number; lineHeight: number } | null {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length < 4 || box.width < imageWidth * 0.2 || box.height > imageHeight * 0.06) return null

  // 188 dùng MIN_FONT_SIZE=14 cho câu trên poster. Thấp hơn mức này rất khó đọc
  // khi ảnh 700–750px được thu về chiều rộng màn hình điện thoại.
  const fontSize = Math.max(14, Math.min(18, Math.round(box.height * 0.82)))
  const desiredWidth =
    box.width < imageWidth * 0.35
      ? Math.min(imageWidth * 0.48, Math.max(box.width, text.length * box.height * 0.42))
      : box.width
  const width = Math.max(1, Math.min(imageWidth, Math.round(desiredWidth)))
  const maxChars = Math.max(8, Math.floor(width / Math.max(1, fontSize * 0.5)))
  const lines = wrapOverlayWords(text, maxChars)
  const lineHeight = Math.max(fontSize + 1, Math.round(fontSize * 1.12))
  const height = Math.max(Math.round(box.height), lines.length * lineHeight + 4)
  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2
  const x = Math.max(0, Math.min(imageWidth - width, Math.round(centerX - width / 2)))
  const y = Math.max(0, Math.min(imageHeight - height, Math.round(centerY - height / 2)))
  return { box: { x, y, width, height }, lines, fontSize, lineHeight }
}

/** Nhãn ngắn: nới khung vẽ quanh tâm OCR để giữ đủ chữ ở cỡ tối thiểu 10px. */
export function fitLocalizedLabelText(
  text: string,
  box: PixelBox,
  imageWidth: number,
  imageHeight: number
): { box: PixelBox; lines: string[]; fontSize: number; lineHeight: number } | null {
  const value = text.trim()
  if (!value) return null
  const fontSize = Math.max(
    MIN_LOCALIZED_FONT_SIZE,
    Math.min(18, Math.round(box.height * 0.72))
  )
  const maxWidth = Math.max(box.width, Math.round(imageWidth * 0.2))
  const desiredWidth = Math.max(box.width, textWidthAt(fontSize, value) + 6)
  const width = Math.max(1, Math.min(imageWidth, maxWidth, Math.round(desiredWidth)))
  const maxChars = Math.max(1, Math.floor((width - 4) / (fontSize * 0.5)))
  const lineHeight = Math.max(fontSize + 1, Math.round(fontSize * 1.12))
  const wrapped = wrapOverlayWords(value, maxChars)
  const height = Math.max(1, Math.min(imageHeight, Math.max(box.height, wrapped.length * lineHeight + 2)))
  const maxLines = Math.max(1, Math.floor(Math.max(1, height - 2) / lineHeight))
  const lines = wrapped.slice(0, maxLines)
  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2
  const x = Math.max(0, Math.min(imageWidth - width, Math.round(centerX - width / 2)))
  const y = Math.max(0, Math.min(imageHeight - height, Math.round(centerY - height / 2)))
  return { box: { x, y, width, height }, lines, fontSize, lineHeight }
}

function boxRemainder(outer: PixelBox, inner: PixelBox): PixelBox[] {
  const ox1 = outer.x
  const oy1 = outer.y
  const ox2 = outer.x + outer.width
  const oy2 = outer.y + outer.height
  const ix1 = Math.max(ox1, inner.x)
  const iy1 = Math.max(oy1, inner.y)
  const ix2 = Math.min(ox2, inner.x + inner.width)
  const iy2 = Math.min(oy2, inner.y + inner.height)
  if (ix2 <= ix1 || iy2 <= iy1) return [outer]
  const parts: PixelBox[] = []
  if (oy1 < iy1) parts.push({ x: ox1, y: oy1, width: ox2 - ox1, height: iy1 - oy1 })
  if (iy2 < oy2) parts.push({ x: ox1, y: iy2, width: ox2 - ox1, height: oy2 - iy2 })
  if (ox1 < ix1) parts.push({ x: ox1, y: iy1, width: ix1 - ox1, height: iy2 - iy1 })
  if (ix2 < ox2) parts.push({ x: ix2, y: iy1, width: ox2 - ix2, height: iy2 - iy1 })
  return parts
}

/**
 * Ô OCR phủ gần cả vùng sản phẩm thì không tô. Dòng chữ hẹp trên da vẫn được vẽ.
 */
export function overlayBoxCoversProductSubject(
  box: { width: number; height: number },
  imageWidth: number,
  imageHeight: number
): boolean {
  const width = Math.max(0, box.width)
  const height = Math.max(0, box.height)
  const imageArea = Math.max(1, imageWidth * imageHeight)
  const wide = width >= imageWidth * 0.34
  const tall = height >= imageHeight * 0.18
  return (width * height) / imageArea >= 0.12 || (wide && tall)
}

/** Nhãn dịch không nằm trọn trong ô OCR. */
export function overlayLabelTextWasClipped(text: string, width: number, height: number): boolean {
  const fitted = fitTableCellText(text, width, height)
  const shown = fitted.lines.join(' ').replace(/\s+/g, ' ').trim()
  return shown !== text.replace(/\s+/g, ' ').trim()
}

/** Chia hàng nhãn bị cắt theo điểm giữa, để các ô không đè nhau. */
export function layoutClippedLabelSlots(
  items: Array<OverlayItem & { tableCell?: boolean }>,
  imageWidth: number,
  imageHeight: number
): void {
  const pending = items.filter(
    (item) =>
      !item.tableCell &&
      !item.specRow &&
      !item.eraseBox &&
      (item.translatedText || '').trim() &&
      overlayLabelTextWasClipped(item.translatedText, item.bbox.width, item.bbox.height)
  )
  const used = new Set<OverlayItem>()
  for (const item of pending) {
    if (used.has(item)) continue
    const yMid = item.bbox.y + item.bbox.height / 2
    const row = pending.filter((other) => {
      const mid = other.bbox.y + other.bbox.height / 2
      return Math.abs(mid - yMid) <= Math.max(6, item.bbox.height * 0.7)
    })
    for (const entry of row) used.add(entry)
    row.sort((a, b) => a.bbox.x - b.bbox.x)
    if (row.length === 1) {
      const entry = row[0]
      const below = items
        .filter((other) => {
          if (other === entry) return false
          const overlap =
            Math.min(entry.bbox.x + entry.bbox.width, other.bbox.x + other.bbox.width) -
            Math.max(entry.bbox.x, other.bbox.x)
          return overlap > 4 && other.bbox.y >= entry.bbox.y + entry.bbox.height - 2
        })
        .sort((a, b) => a.bbox.y - b.bbox.y)[0]
      const beside = items
        .filter((other) => {
          if (other === entry) return false
          const overlap =
            Math.min(entry.bbox.y + entry.bbox.height, other.bbox.y + other.bbox.height) -
            Math.max(entry.bbox.y, other.bbox.y)
          return overlap > 2 && other.bbox.x >= entry.bbox.x + entry.bbox.width - 2
        })
        .sort((a, b) => a.bbox.x - b.bbox.x)[0]
      const y = entry.bbox.y
      const gap = below ? below.bbox.y - 2 - y : entry.bbox.height
      const height = Math.max(entry.bbox.height, Math.min(gap, entry.bbox.height + 72))
      const besideGap = beside ? beside.bbox.x - (entry.bbox.x + entry.bbox.width) : 999
      const right = beside && besideGap < 96
        ? beside.bbox.x - 4
        : entry.bbox.x + entry.bbox.width
      const width = Math.max(entry.bbox.width, right - entry.bbox.x)
      entry.eraseBox = {
        x: entry.bbox.x,
        y,
        width: Math.max(8, Math.min(imageWidth - entry.bbox.x, width)),
        height: Math.max(entry.bbox.height, Math.min(height, imageHeight - y)),
      }
      entry.textAlign = 'start'
      entry.textOriginX = entry.bbox.x
      continue
    }
    const centers = row.map((entry) => entry.bbox.x + entry.bbox.width / 2)
    row.forEach((entry, index) => {
      const center = centers[index]
      const prev = index > 0 ? centers[index - 1] : null
      const next = index + 1 < centers.length ? centers[index + 1] : null
      const half =
        prev != null
          ? (center - prev) / 2
          : next != null
            ? (next - center) / 2
            : entry.bbox.width / 2
      const left = prev != null ? (prev + center) / 2 : Math.max(0, center - half)
      const right = next != null ? (center + next) / 2 : Math.min(imageWidth, center + half)
      const gap = 4
      const x = Math.max(0, Math.min(imageWidth - 1, Math.round(left + gap)))
      const width = Math.max(8, Math.min(imageWidth - x, Math.round(right - gap - x)))
      const measureW = Math.min(width, Math.max(88, Math.round(entry.bbox.width * 2.2)))
      const fontSize = 15
      const lineHeight = Math.round(fontSize * 1.2)
      const maxChars = Math.max(1, Math.floor(Math.max(8, measureW - 4) / (fontSize * 0.5)))
      const lines = wrapOverlayWords(entry.translatedText.trim(), maxChars)
      const height = Math.max(
        entry.bbox.height,
        Math.min(Math.max(1, imageHeight - entry.bbox.y), lines.length * lineHeight + 8)
      )
      entry.eraseBox = { x, y: entry.bbox.y, width, height }
    })
    const rowHeight = Math.max(...row.map((entry) => entry.eraseBox?.height ?? entry.bbox.height))
    for (const entry of row) {
      if (!entry.eraseBox) continue
      entry.eraseBox = {
        ...entry.eraseBox,
        height: Math.min(Math.max(1, imageHeight - entry.eraseBox.y), rowHeight),
      }
    }
  }
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
  // Chữ trên nền sáng (trắng, kem, be): mean sáng cao (>180) và độ lệch màu vừa phải -> không phải da/kim loại thật
  if (mean > 180 && colorSpread < 20) return false
  // Nhãn đen trên bảng/sơ đồ xám trung tính: phần chữ làm std cao nhưng gần như
  // không có độ lệch màu. Không được nhầm các nhãn 尺码 / 脚围 / 脚长 là ảnh sản phẩm.
  if (mean > 145 && colorSpread < 8) return false
  if (colorSpread > 12 && std > 16) return true
  return std > 26 && mid / n > 0.4
}

/** Logo/domain trên header trắng. Nền quanh chữ sáng thì không đục lỗ. */
export async function overlayRegionIsFlatLightHeader(
  imageBuffer: Buffer,
  box: PixelBox,
  imageWidth: number,
  imageHeight: number
): Promise<boolean> {
  if (box.y > imageHeight * 0.32) return false
  try {
    const rgb = await surroundingBackgroundColor(imageBuffer, box, imageWidth, imageHeight)
    const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
    return luminance > 210
  } catch {
    return false
  }
}

/**
 * Chữ đen trên ảnh sáng có vân (lông vũ, vải). Xóa đúng nét, không đè tấm xám.
 * Nền trắng phẳng và panel màu không đi vào đây.
 */
async function coverDarkGlyphsOnLightPhoto(
  imageBuffer: Buffer,
  box: PixelBox,
  imageWidth: number,
  imageHeight: number
): Promise<{ input: Buffer; top: number; left: number } | null> {
  const pad = 2
  const left = Math.max(0, Math.round(box.x) - pad)
  const top = Math.max(0, Math.round(box.y) - pad)
  const width = Math.max(1, Math.min(imageWidth - left, Math.round(box.width) + pad * 2))
  const height = Math.max(1, Math.min(imageHeight - top, Math.round(box.height) + pad * 2))
  if (width < 8 || height < 8) return null
  const extracted = await sharp(imageBuffer)
    .extract({ left, top, width, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = extracted.info.channels
  const data = extracted.data
  const lumAt = (offset: number) =>
    0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]
  const total = width * height
  let dark = 0
  let lightN = 0
  let lightSum = 0
  let spread = 0
  for (let pixel = 0; pixel < total; pixel++) {
    const offset = pixel * channels
    const lum = lumAt(offset)
    if (lum < 125) dark += 1
    else if (lum >= 150) {
      lightN += 1
      lightSum += lum
      spread += Math.abs(data[offset] - data[offset + 1]) + Math.abs(data[offset + 1] - data[offset + 2])
    }
  }
  const darkRatio = dark / total
  if (darkRatio < 0.03 || darkRatio > 0.55) return null
  if (lightN < total * 0.3) return null
  if (lightSum / lightN < 175 || spread / lightN > 28) return null
  // Nền trắng phẳng: tô đặc cả ô. Xóa nét chỉ dành cho vải/lông có vân.
  if (lightSum / lightN > 225) return null
  const lumOf = (x: number, y: number) => lumAt((y * width + x) * channels)
  const seed: boolean[] = new Array(total)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) seed[y * width + x] = lumOf(x, y) < 110
  }
  const isInk = (x: number, y: number) => {
    if (seed[y * width + x]) return true
    if (lumOf(x, y) >= 165) return false
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx
        const yy = y + dy
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue
        if (seed[yy * width + xx]) return true
      }
    }
    return false
  }
  const out = Buffer.from(data)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isInk(x, y)) continue
      const offset = (y * width + x) * channels
      const jx = ((x * 13 + y * 7) % 9) - 4
      const jy = ((x * 5 + y * 11) % 9) - 4
      let copied = false
      for (let radius = 1; radius <= 28 && !copied; radius++) {
        for (let delta = -radius; delta <= radius && !copied; delta++) {
          const around: Array<[number, number]> = [
            [x + delta + jx, y - radius + jy],
            [x + delta + jx, y + radius + jy],
            [x - radius + jx, y + delta + jy],
            [x + radius + jx, y + delta + jy],
          ]
          for (const [xx, yy] of around) {
            if (xx < 0 || yy < 0 || xx >= width || yy >= height || isInk(xx, yy)) continue
            const from = (yy * width + xx) * channels
            out[offset] = data[from]
            out[offset + 1] = data[from + 1]
            out[offset + 2] = data[from + 2]
            copied = true
            break
          }
        }
      }
      if (!copied) {
        out[offset] = 236
        out[offset + 1] = 236
        out[offset + 2] = 236
      }
    }
  }
  const png = await sharp(out, { raw: { width, height, channels } }).png().toBuffer()
  return { input: png, top, left }
}

/** Nhãn thẻ trắng không được tràn xuống da bên dưới. */
async function clampCaptionAbovePhoto(
  imageBuffer: Buffer,
  box: PixelBox,
  imageWidth: number,
  imageHeight: number
): Promise<PixelBox> {
  let height = box.height
  const floor = Math.max(box.height > 0 ? 12 : 1, Math.round(box.height * 0.45))
  while (height > floor) {
    const stripH = Math.min(8, height)
    const strip = { x: box.x, y: box.y + height - stripH, width: box.width, height: stripH }
    if (!(await overlayRegionIsProductPhoto(imageBuffer, strip, imageWidth, imageHeight))) break
    height -= 6
  }
  return { ...box, height: Math.max(1, height) }
}

function boxBlurLuminance(lum: Float64Array, width: number, height: number, radius: number): Float64Array {
  const out = new Float64Array(lum.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let n = 0
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= width) continue
          sum += lum[ny * width + nx]
          n += 1
        }
      }
      out[y * width + x] = n ? sum / n : lum[y * width + x]
    }
  }
  return out
}

/**
 * Xóa nét chữ tương phản trên da, giữ vân. Không thay cả ô bằng một màu.
 * Chữ trắng trên kính mờ chỉ sáng hơn nền ngay quanh nó.
 */
async function suppressContrastGlyphs(imageBuffer: Buffer, box: PixelBox): Promise<Buffer | null> {
  const left = Math.max(0, Math.round(box.x))
  const top = Math.max(0, Math.round(box.y))
  const width = Math.max(1, Math.round(box.width))
  const height = Math.max(1, Math.round(box.height))
  const extracted = await sharp(imageBuffer)
    .extract({ left, top, width, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = extracted.info.channels
  const data = Buffer.from(extracted.data.subarray(0, width * height * channels))
  const total = width * height
  const lum = new Float64Array(total)
  for (let i = 0; i < total; i++) {
    const offset = i * channels
    lum[i] = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]
  }
  const blur = boxBlurLuminance(lum, width, height, 2)
  const sorted = Array.from(lum).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const ink = new Uint8Array(total)
  for (let i = 0; i < total; i++) {
    const lightInk = lum[i] > 188 && lum[i] > blur[i] + 14
    const darkInk = median > 160 && lum[i] < 80 && blur[i] - lum[i] > 22
    if (lightInk || darkInk) ink[i] = 1
  }
  const grown = new Uint8Array(ink)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (!ink[i]) continue
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          grown[ny * width + nx] = 1
        }
      }
    }
  }
  let inkCount = 0
  for (let i = 0; i < total; i++) if (grown[i]) inkCount += 1
  if (inkCount < 8 || inkCount > total * 0.55) return null
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (!grown[i]) continue
      const samples: number[][] = [[], [], []]
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const ni = ny * width + nx
          if (grown[ni]) continue
          const offset = ni * channels
          samples[0].push(data[offset])
          samples[1].push(data[offset + 1])
          samples[2].push(data[offset + 2])
        }
      }
      const offset = i * channels
      if (!samples[0].length) continue
      for (let channel = 0; channel < 3; channel++) {
        const values = samples[channel]
        values.sort((a, b) => a - b)
        data[offset + channel] = values[Math.floor(values.length / 2)]
      }
    }
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer()
}

/** Vision chỉ trả khung chữ, không trả font-size. Cỡ cũ = chiều cao khung, sàn 10px. */
export function ocrLineFontSize(boxHeight: number): number {
  return Math.max(MIN_LOCALIZED_FONT_SIZE, Math.round(Math.max(1, boxHeight)))
}

/** Một màu đặc cho cả ô: bỏ nét trắng, lấy trung vị phần nền còn lại. */
async function solidPlateColor(imageBuffer: Buffer, box: PixelBox): Promise<[number, number, number]> {
  const left = Math.max(0, Math.round(box.x))
  const top = Math.max(0, Math.round(box.y))
  const width = Math.max(1, Math.round(box.width))
  const height = Math.max(1, Math.round(box.height))
  const extracted = await sharp(imageBuffer)
    .extract({ left, top, width, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = extracted.info.channels
  const samples: number[][] = [[], [], []]
  const total = extracted.info.width * extracted.info.height
  for (let i = 0; i < total; i++) {
    const offset = i * channels
    const r = extracted.data[offset]
    const g = extracted.data[offset + 1]
    const b = extracted.data[offset + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    if (lum > 235) continue
    samples[0].push(r)
    samples[1].push(g)
    samples[2].push(b)
  }
  return [0, 1, 2].map((channel) => {
    const values = samples[channel]
    if (!values.length) return 32
    values.sort((a, b) => a - b)
    return values[Math.floor(values.length / 2)]
  }) as [number, number, number]
}

function boxesOverlap(a: PixelBox, b: PixelBox, gap = 0): boolean {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y
}

/** Khoảng trống quanh ô chữ: dừng trước khối cùng hàng và khối ngay trên / dưới. */
export function clampSlotToNeighbors(
  source: PixelBox,
  slot: PixelBox,
  neighbors: PixelBox[],
  gap = 6
): PixelBox {
  let left = slot.x
  let top = slot.y
  let right = slot.x + slot.width
  let bottom = slot.y + slot.height
  for (const other of neighbors) {
    if (boxesOverlap(source, other)) continue
    const sameRow =
      Math.min(source.y + source.height, other.y + other.height) - Math.max(source.y, other.y) >
      Math.min(source.height, other.height) * 0.35
    if (sameRow && other.x + other.width <= source.x + 2) left = Math.max(left, other.x + other.width + gap)
    else if (sameRow && other.x >= source.x + source.width - 2) right = Math.min(right, other.x - gap)
    const aligned = Math.min(source.x + source.width, other.x + other.width) - Math.max(source.x, other.x) > 8
    if (aligned && other.y + other.height <= source.y + 2) top = Math.max(top, other.y + other.height + gap)
    else if (aligned && other.y >= source.y + source.height - 2) bottom = Math.min(bottom, other.y - gap)
  }
  left = Math.max(slot.x, Math.min(left, source.x))
  top = Math.max(slot.y, Math.min(top, source.y))
  right = Math.min(slot.x + slot.width, Math.max(right, source.x + source.width))
  bottom = Math.min(slot.y + slot.height, Math.max(bottom, source.y + source.height))
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  }
}

/**
 * Nền đặc vừa khít chữ. Cỡ bắt đầu bằng chiều cao khung OCR.
 * Hết chỗ ngang thì xuống dòng; hết chỗ dọc thì hạ cỡ, không dưới 10px.
 * Khung vẽ luôn nằm trong slot, không tràn sang khối bên cạnh.
 */
export function fitSolidPlateLayout(
  text: string,
  source: PixelBox,
  slot: PixelBox,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number; width: number; height: number; fontSize: number; lines: string[]; lineHeight: number } {
  const phrase = text.trim()
  const pad = 8
  const cap = ocrLineFontSize(source.height)
  let fontSize = cap
  let lines = [phrase]
  let lineHeight = Math.round(fontSize * 1.15)
  for (; fontSize >= MIN_LOCALIZED_FONT_SIZE; fontSize--) {
    lineHeight = Math.round(fontSize * 1.15)
    const maxChars = Math.max(1, Math.floor((slot.width - pad) / (fontSize * 0.5)))
    lines = textWidthAt(fontSize, phrase) + pad <= slot.width ? [phrase] : wrapOverlayWords(phrase, maxChars)
    const widest = Math.max(...lines.map((line) => textWidthAt(fontSize, line)))
    if (widest + pad <= slot.width + 1 && lines.length * lineHeight + pad <= slot.height + 1) break
  }
  fontSize = Math.max(MIN_LOCALIZED_FONT_SIZE, fontSize)
  lineHeight = Math.round(fontSize * 1.15)
  const widest = Math.max(1, ...lines.map((line) => textWidthAt(fontSize, line)))
  const plateW = Math.max(1, Math.min(slot.width, Math.ceil(Math.max(source.width, widest + pad))))
  const plateH = Math.max(1, Math.min(slot.height, Math.max(source.height, lines.length * lineHeight + pad)))
  let x = Math.round(source.x + source.width / 2 - plateW / 2)
  let y = Math.round(source.y + source.height / 2 - plateH / 2)
  if (plateW >= source.width) {
    x = Math.max(source.x + source.width - plateW, Math.min(source.x, x))
  }
  if (plateH >= source.height) {
    y = Math.max(source.y + source.height - plateH, Math.min(source.y, y))
  }
  x = Math.max(slot.x, Math.min(slot.x + slot.width - plateW, x))
  y = Math.max(slot.y, Math.min(slot.y + slot.height - plateH, y))
  let width = plateW
  let height = plateH
  if (x > source.x) x = Math.round(source.x)
  if (y > source.y) y = Math.round(source.y)
  if (x + width < source.x + source.width) width = Math.round(source.x + source.width - x)
  if (y + height < source.y + source.height) height = Math.round(source.y + source.height - y)
  x = Math.max(0, Math.min(imageWidth - width, x))
  y = Math.max(0, Math.min(imageHeight - height, y))
  return { x, y, width, height, fontSize, lines, lineHeight }
}

/** Nới ô trên cùng một mặt da, dừng khi màu đổi hoặc chạm khối chữ khác. */
async function measureSameSurfaceSlot(
  imageBuffer: Buffer,
  source: PixelBox,
  color: [number, number, number],
  neighbors: PixelBox[],
  imageWidth: number,
  imageHeight: number
): Promise<PixelBox> {
  const reach = 320
  const left0 = Math.max(0, Math.round(source.x) - reach)
  const top0 = Math.max(0, Math.round(source.y) - reach)
  const right0 = Math.min(imageWidth, Math.round(source.x + source.width) + reach)
  const bottom0 = Math.min(imageHeight, Math.round(source.y + source.height) + reach)
  const width = Math.max(1, right0 - left0)
  const height = Math.max(1, bottom0 - top0)
  const extracted = await sharp(imageBuffer)
    .extract({ left: left0, top: top0, width, height })
    .removeAlpha()
    .raw()
    .toBuffer()
  const channels = 3
  const plateLum = 0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]
  const medianStrip = (x1: number, y1: number, x2: number, y2: number): [number, number, number] | null => {
    const samples: number[][] = [[], [], []]
    const stepX = Math.max(1, Math.floor((x2 - x1) / 8))
    const stepY = Math.max(1, Math.floor((y2 - y1) / 8))
    for (let y = y1; y < y2; y += stepY) {
      for (let x = x1; x < x2; x += stepX) {
        const offset = (y * width + x) * channels
        samples[0].push(extracted[offset])
        samples[1].push(extracted[offset + 1])
        samples[2].push(extracted[offset + 2])
      }
    }
    if (samples[0].length < 4) return null
    return [0, 1, 2].map((channel) => {
      const values = samples[channel]
      values.sort((a, b) => a - b)
      return values[Math.floor(values.length / 2)]
    }) as [number, number, number]
  }
  const sameSurface = (x1: number, y1: number, x2: number, y2: number) => {
    const span = Math.max(1, y2 - y1)
    const slices = 3
    for (let slice = 0; slice < slices; slice++) {
      const sy1 = y1 + Math.floor((span * slice) / slices)
      const sy2 = y1 + Math.floor((span * (slice + 1)) / slices)
      const rgb = medianStrip(x1, sy1, x2, Math.max(sy1 + 1, sy2))
      if (!rgb) return false
      const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
      if (Math.abs(lum - plateLum) > 36 || colorDistance(rgb, color) > 90) return false
    }
    return true
  }
  const vertical = clampSlotToNeighbors(
    source,
    { x: 0, y: 0, width: imageWidth, height: imageHeight },
    neighbors
  )
  let left = Math.max(0, Math.round(source.x) - left0)
  let top = Math.max(0, Math.round(source.y) - top0)
  let right = Math.min(width, left + Math.max(1, Math.round(source.width)))
  let bottom = Math.min(height, top + Math.max(1, Math.round(source.height)))
  const probeTop = Math.max(0, Math.min(top, Math.round(vertical.y) - top0))
  const probeBottom = Math.min(height, Math.max(bottom, Math.round(vertical.y + vertical.height) - top0))
  const blocked = (x: number, y: number, w: number, h: number) => {
    const probe = { x: left0 + x, y: top0 + y, width: w, height: h }
    return neighbors.some((other) => boxesOverlap(probe, other, 4))
  }
  const step = 4
  while (
    left - step >= 0 &&
    !blocked(left - step, probeTop, step, probeBottom - probeTop) &&
    sameSurface(left - step, probeTop, left, probeBottom)
  ) {
    left -= step
  }
  while (
    right + step <= width &&
    !blocked(right, probeTop, step, probeBottom - probeTop) &&
    sameSurface(right, probeTop, right + step, probeBottom)
  ) {
    right += step
  }
  while (top - step >= 0 && !blocked(left, top - step, right - left, step) && sameSurface(left, top - step, right, top)) {
    top -= step
  }
  while (bottom + step <= height && !blocked(left, bottom, right - left, step) && sameSurface(left, bottom, right, bottom + step)) {
    bottom += step
  }
  return clampSlotToNeighbors(
    source,
    { x: left0 + left, y: top0 + top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) },
    neighbors
  )
}

/** 188 `_repaint_bbox_to_background`: xóa nét lệch màu nền sát ô, giữ kính mờ / da. */
async function repaintBboxToBackground(
  imageBuffer: Buffer,
  box: PixelBox,
  imageWidth: number,
  imageHeight: number
): Promise<{ png: Buffer; ink: string } | null> {
  const pad = 4
  const x1 = Math.max(0, Math.round(box.x))
  const y1 = Math.max(0, Math.round(box.y))
  const x2 = Math.min(imageWidth, x1 + Math.max(1, Math.round(box.width)))
  const y2 = Math.min(imageHeight, y1 + Math.max(1, Math.round(box.height)))
  const width = x2 - x1
  const height = y2 - y1
  if (width < 2 || height < 2) return null
  const ox1 = Math.max(0, x1 - pad)
  const oy1 = Math.max(0, y1 - pad)
  const ox2 = Math.min(imageWidth, x2 + pad)
  const oy2 = Math.min(imageHeight, y2 + pad)
  const extracted = await sharp(imageBuffer)
    .extract({ left: ox1, top: oy1, width: ox2 - ox1, height: oy2 - oy1 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = extracted.info.channels
  const outerW = extracted.info.width
  const outerH = extracted.info.height
  const ring: number[][] = [[], [], []]
  const ix1 = x1 - ox1
  const iy1 = y1 - oy1
  const ix2 = ix1 + width
  const iy2 = iy1 + height
  for (let y = 0; y < outerH; y++) {
    for (let x = 0; x < outerW; x++) {
      if (x >= ix1 && x < ix2 && y >= iy1 && y < iy2) continue
      const offset = (y * outerW + x) * channels
      ring[0].push(extracted.data[offset])
      ring[1].push(extracted.data[offset + 1])
      ring[2].push(extracted.data[offset + 2])
    }
  }
  if (ring[0].length < 9) return null
  const medianOf = (values: number[]) => {
    const copy = [...values].sort((a, b) => a - b)
    return copy[Math.floor(copy.length / 2)] ?? 0
  }
  const ringRgb = [0, 1, 2].map((channel) => medianOf(ring[channel]))
  const inner = Buffer.alloc(width * height * 3)
  const innerLum: number[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = ((iy1 + y) * outerW + (ix1 + x)) * channels
      const i = y * width + x
      const rgb = [extracted.data[src], extracted.data[src + 1], extracted.data[src + 2]]
      inner[i * 3] = rgb[0]
      inner[i * 3 + 1] = rgb[1]
      inner[i * 3 + 2] = rgb[2]
      innerLum.push(0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2])
    }
  }
  const ringLum = 0.299 * ringRgb[0] + 0.587 * ringRgb[1] + 0.114 * ringRgb[2]
  const interiorLum = medianOf(innerLum)
  // Kính mờ sáng hơn da quanh ô. Lấy màu kính bên trong, không lấy da đen ở viền.
  const panel = interiorLum > ringLum + 25
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < innerLum.length; i++) {
    const lightInk = panel
      ? innerLum[i] > 248
      : Math.max(
          Math.abs(inner[i * 3] - ringRgb[0]),
          Math.abs(inner[i * 3 + 1] - ringRgb[1]),
          Math.abs(inner[i * 3 + 2] - ringRgb[2])
        ) > 28
    const darkInk = interiorLum > 150 && innerLum[i] < Math.min(90, interiorLum - 40)
    if (lightInk || darkInk) mask[i] = 1
  }
  const grown = new Uint8Array(mask)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          grown[ny * width + nx] = 1
        }
      }
    }
  }
  if (!panel) {
    let inkCount = 0
    for (let i = 0; i < grown.length; i++) if (grown[i]) inkCount += 1
    if (inkCount > grown.length * 0.42) grown.fill(0)
  }
  const fillSamples: number[][] = [[], [], []]
  for (let i = 0; i < grown.length; i++) {
    if (grown[i]) continue
    fillSamples[0].push(inner[i * 3])
    fillSamples[1].push(inner[i * 3 + 1])
    fillSamples[2].push(inner[i * 3 + 2])
  }
  const bg =
    fillSamples[0].length >= 9
      ? [0, 1, 2].map((channel) => medianOf(fillSamples[channel]))
      : ringRgb
  const inkSamples: number[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (!grown[i]) continue
      inkSamples.push(innerLum[i])
      const nearby: number[][] = [[], [], []]
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const ni = ny * width + nx
          if (grown[ni]) continue
          nearby[0].push(inner[ni * 3])
          nearby[1].push(inner[ni * 3 + 1])
          nearby[2].push(inner[ni * 3 + 2])
        }
      }
      for (let channel = 0; channel < 3; channel++) {
        const values = nearby[channel]
        inner[i * 3 + channel] = values.length ? medianOf(values) : bg[channel]
      }
    }
  }
  inkSamples.sort((a, b) => a - b)
  const inkLum = inkSamples.length ? inkSamples[Math.floor(inkSamples.length / 2)] : 255
  const bgLum = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]
  const ink = inkLum >= 186 || (inkLum - bgLum >= 35 && inkLum >= 150) ? '#ffffff' : '#000000'
  const png = await sharp(inner, { raw: { width, height, channels: 3 } }).png().toBuffer()
  return { png, ink }
}

async function findInsetWhiteCard(
  imageBuffer: Buffer,
  src: PixelBox,
  imageWidth: number,
  imageHeight: number
): Promise<PixelBox | null> {
  const top = Math.max(0, Math.round(src.y) - 24)
  const bottom = Math.min(imageHeight, Math.round(src.y + src.height) + 96)
  const height = bottom - top
  if (height < 16) return null
  const extracted = await sharp(imageBuffer)
    .extract({ left: 0, top, width: imageWidth, height })
    .removeAlpha()
    .raw()
    .toBuffer()
  const grayAt = (x: number, y: number) => {
    const offset = (y * imageWidth + x) * 3
    return 0.299 * extracted[offset] + 0.587 * extracted[offset + 1] + 0.114 * extracted[offset + 2]
  }
  const cx = Math.max(0, Math.min(imageWidth - 1, Math.round(src.x + src.width / 2)))
  const closed = (x: number, y: number) => {
    for (let delta = -20; delta <= 20; delta++) {
      const nx = x + delta
      if (nx >= 0 && nx < imageWidth && grayAt(nx, y) > 210) return true
    }
    return false
  }
  let best: { span: number; left: number; right: number } | null = null
  for (let y = 0; y < height; y++) {
    if (!closed(cx, y)) continue
    let left = cx
    while (left > 0 && closed(left - 1, y)) left -= 1
    let right = cx
    while (right < imageWidth - 1 && closed(right + 1, y)) right += 1
    const span = right - left
    if (span < imageWidth * 0.28 || span > imageWidth * 0.92) continue
    if (!best || span > best.span) best = { span, left, right }
  }
  if (!best) return null
  const rowOk = (y: number) => {
    let count = 0
    let bright = 0
    for (let x = best.left; x <= best.right; x += 2) {
      count += 1
      if (grayAt(x, y) > 200) bright += 1
    }
    return count > 0 && bright / count > 0.45
  }
  let y1 = 0
  let y2 = 0
  for (let y = 0; y < height; y++) {
    if (!rowOk(y)) continue
    y1 = y
    break
  }
  for (let y = height - 1; y >= 0; y--) {
    if (!rowOk(y)) continue
    y2 = y
    break
  }
  if (y2 - y1 < 20) return null
  return {
    x: best.left,
    y: top + y1,
    width: best.right - best.left + 1,
    height: y2 - y1 + 1,
  }
}

/** 188 `_apply_inset_caption_cards`: nhãn cùng hàng trên một thẻ trắng dùng chung một dải. */
async function layoutInsetCaptionCards(
  imageBuffer: Buffer,
  items: Array<OverlayItem & { tableCell?: boolean }>,
  imageWidth: number,
  imageHeight: number,
  obstacles: OverlayItem[]
): Promise<PixelBox | null> {
  const pending: Array<OverlayItem & { tableCell?: boolean }> = []
  for (const item of items) {
    if (item.tableCell || !(item.translatedText || '').trim()) continue
    if (await overlayRegionIsProductPhoto(imageBuffer, item.bbox, imageWidth, imageHeight)) continue
    pending.push(item)
  }
  const used = new Set<OverlayItem>()
  for (const item of pending) {
    if (used.has(item)) continue
    const yMid = item.bbox.y + item.bbox.height / 2
    const row = pending.filter((other) => {
      const mid = other.bbox.y + other.bbox.height / 2
      return Math.abs(mid - yMid) <= Math.max(6, item.bbox.height * 0.6)
    })
    if (row.length < 2) continue
    const spread = Math.max(...row.map((entry) => entry.bbox.x)) - Math.min(...row.map((entry) => entry.bbox.x))
    if (spread < 36) continue
    const card = await findInsetWhiteCard(imageBuffer, item.bbox, imageWidth, imageHeight)
    if (!card) continue
    for (const entry of row) used.add(entry)
    row.sort((a, b) => a.bbox.x - b.bbox.x)
    const colW = Math.max(8, Math.floor(card.width / row.length))
    const fontSize = Math.max(
      mobileReadableFontSize(imageWidth),
      ...row.map((entry) => ocrLineFontSize(entry.bbox.height))
    )
    const gap = 4
    row.forEach((entry, index) => {
      const x = card.x + index * colW + gap
      const right = index === row.length - 1 ? card.x + card.width - gap : card.x + (index + 1) * colW - gap
      const column = {
        x,
        y: entry.bbox.y,
        width: Math.max(8, right - x),
        height: Math.max(entry.bbox.height, card.y + card.height - entry.bbox.y),
      }
      const plate = fitTextPlate(entry.translatedText, column, fontSize)
      let bottom = plate.y + plate.height
      for (const other of obstacles) {
        const overlap = Math.min(column.x + column.width, other.bbox.x + other.bbox.width) - Math.max(column.x, other.bbox.x)
        if (overlap < 8) continue
        if (other.bbox.y < entry.bbox.y + entry.bbox.height - 2) continue
        if (other.bbox.y > entry.bbox.y + entry.bbox.height + 28) continue
        bottom = Math.max(bottom, other.bbox.y + other.bbox.height + 2)
      }
      entry.eraseBox = { x: plate.x, y: plate.y, width: plate.width, height: Math.max(plate.height, bottom - plate.y) }
      entry.lockedFont = plate.fontSize
      entry.lockedLines = plate.lines
      entry.skipFill = true
      entry.drawInk = '#000000'
    })
  }
  return null
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
 * Cột thông số một dòng (chất liệu, màu, size): cùng mép trái, một cỡ chữ, không căn giữa.
 */
export function layoutSpecSheetRows(items: OverlayItem[], imageWidth: number): void {
  const candidates = items.filter((item) => {
    const text = (item.translatedText || '').trim()
    if (!text || item.tableCell || item.eraseOriginal) return false
    if (text.split(/\s+/).length >= 12) return false
    if (item.bbox.height > 32 || item.bbox.height < 6) return false
    if (item.bbox.width > imageWidth * 0.55) return false
    return true
  })
  const pool = [...candidates].sort((a, b) => a.bbox.x - b.bbox.x || a.bbox.y - b.bbox.y)
  let best: OverlayItem[] = []
  for (const seed of pool) {
    const group = pool.filter((item) => Math.abs(item.bbox.x - seed.bbox.x) <= 16)
    if (group.length > best.length) best = group
  }
  if (best.length < 4) return
  const left = Math.min(...best.map((item) => item.bbox.x))
  const right = Math.min(
    imageWidth - 8,
    Math.max(left + 48, ...best.map((item) => item.bbox.x + item.bbox.width), left + Math.round(imageWidth * 0.34))
  )
  const inner = Math.max(40, right - left - 28)
  let font = 14
  for (; font > MIN_LOCALIZED_FONT_SIZE; font--) {
    if (best.every((item) => textWidthAt(font, item.translatedText.trim()) <= inner)) break
  }
  for (const item of best) {
    item.specRow = true
    item.textAlign = 'start'
    item.textOriginX = left
    item.lockedFont = font
    item.eraseBox = {
      x: item.bbox.x,
      y: Math.max(0, item.bbox.y - 1),
      width: Math.max(item.bbox.width, right - item.bbox.x),
      height: item.bbox.height + 2,
    }
  }
}

/** Icon tròn/kim cương sát mép trái dòng thông số. Cắt lại từ ảnh gốc sau khi tô chữ. */
async function leadingIconPatch(
  imageBuffer: Buffer,
  box: PixelBox,
  imageWidth: number,
  imageHeight: number
): Promise<{ input: Buffer; top: number; left: number } | null> {
  const searchLeft = Math.max(0, Math.round(box.x) - 34)
  const searchRight = Math.min(imageWidth, Math.round(box.x) + 8)
  const top = Math.max(0, Math.round(box.y) - 2)
  const height = Math.min(imageHeight - top, Math.round(box.height) + 4)
  const width = searchRight - searchLeft
  if (width < 12 || height < 8) return null
  const extracted = await sharp(imageBuffer)
    .extract({ left: searchLeft, top, width, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = extracted.info.channels
  const darkCols: number[] = []
  for (let x = 0; x < width; x++) {
    let dark = 0
    for (let y = 0; y < height; y++) {
      const offset = (y * width + x) * channels
      const lum =
        0.3 * extracted.data[offset] + 0.59 * extracted.data[offset + 1] + 0.11 * extracted.data[offset + 2]
      if (lum < 155) dark += 1
    }
    if (dark >= 2) darkCols.push(x)
  }
  if (darkCols.length < 4) return null
  const runs: number[][] = []
  let run: number[] = []
  for (const x of darkCols) {
    if (!run.length || x - run[run.length - 1] <= 2) run.push(x)
    else {
      runs.push(run)
      run = [x]
    }
  }
  if (run.length) runs.push(run)
  const boxX = Math.round(box.x) - searchLeft
  const icon = runs.find((columns) => {
    const span = columns[columns.length - 1] - columns[0]
    const right = columns[columns.length - 1]
    const center = (columns[0] + right) / 2
    return span >= 6 && span <= 28 && right <= boxX - 4 && center <= boxX + 6
  })
  if (!icon) return null
  const x1 = Math.max(0, icon[0] - 1)
  const x2 = Math.min(width - 1, icon[icon.length - 1] + 1)
  const crop = await sharp(imageBuffer)
    .extract({ left: searchLeft + x1, top, width: Math.max(1, x2 - x1 + 1), height })
    .png()
    .toBuffer()
  return { input: crop, top, left: searchLeft + x1, width: Math.max(1, x2 - x1 + 1) }
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

  const obstacles = options?.obstacles ?? []
  const drawItems: Array<OverlayItem & { tableCell?: boolean }> = []
  for (const band of splitOverlayVerticalBands(items)) {
    let bandIsTable = overlayItemsLookLikeTable(band)
    let expanded = bandIsTable ? expandTableCellBoxes(band, imageWidth, obstacles) : band
    if (bandIsTable && (await tableExpansionCoversPhoto(imageBuffer, expanded, imageWidth, imageHeight))) {
      bandIsTable = false
      expanded = band
    }
    for (const item of expanded) drawItems.push({ ...item, tableCell: bandIsTable })
  }
  layoutSpecSheetRows(drawItems, imageWidth)
  layoutClippedLabelSlots(drawItems, imageWidth, imageHeight)
  const captionBand = await layoutInsetCaptionCards(imageBuffer, drawItems, imageWidth, imageHeight, obstacles)
  if (captionBand) {
    backgrounds.push({
      input: Buffer.from(
        `<svg width="${captionBand.width}" height="${captionBand.height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#ffffff"/></svg>`
      ),
      top: captionBand.y,
      left: captionBand.x,
    })
  }
  const eraseNeighbors = [...drawItems, ...obstacles]
  if (options?.sampleBackground) {
    for (const item of drawItems) {
      if (item.skipFill || item.lockedLines?.length) continue
      let paint: OverlayPaint | null = null
      try {
        paint = await sampleOverlayPaint(imageBuffer, item.bbox, imageWidth, imageHeight)
      } catch {
        continue
      }
      if (!paint.flat) continue
      const fillLum = 0.299 * paint.fill[0] + 0.587 * paint.fill[1] + 0.114 * paint.fill[2]
      const inkLum = 0.299 * paint.ink[0] + 0.587 * paint.ink[1] + 0.114 * paint.ink[2]
      // Vân sáng (lông vũ) bị nhận nhầm thành nền xám. Chữ xám trên trắng thật vẫn giữ.
      if (fillLum < 230 && fillLum > 180 && inkLum > 130 && inkLum < fillLum) continue
      if (item.eraseOriginal && !(item.translatedText || '').trim() && fillLum > 210) continue
      item.fillPaint = rgbCss(paint.fill)
      item.drawInk = rgbCss(paint.ink)
      const glyphs = await expandBoxToGlyphs(imageBuffer, item.bbox, paint, imageWidth, imageHeight)
      item.bbox = glyphs
      const phrase = (item.translatedText || '').trim()
      const readable = readableOverlayFont(imageWidth)
      const sizeFont = item.specRow
        ? item.lockedFont || 14
        : Math.min(48, Math.max(readable, Math.round(item.bbox.height * 0.92)))
      const need = item.specRow
        ? Math.max(item.bbox.width, item.eraseBox?.width || 0)
        : phrase
          ? Math.ceil(paintLineWidth(sizeFont, phrase) + 12)
          : item.bbox.width + 6
      const others = drawItems
        .filter((other) => other !== item)
        .map((other) => other.eraseBox ?? other.bbox)
      item.eraseBox = await widenAlongFill(
        imageBuffer,
        item.bbox,
        paint.fill,
        [...others, ...obstacles],
        imageWidth,
        imageHeight,
        need
      )
      if (item.tableCell && item.sourceBbox) {
        const src = item.sourceBbox
        const bottom = src.y + Math.max(src.height, 18) + 2
        const clampRow = (box: { x: number; y: number; width: number; height: number }) => {
          if (box.y >= bottom) return box
          return { ...box, height: Math.max(src.height, Math.min(box.height, bottom - box.y)) }
        }
        item.bbox = clampRow(item.bbox)
        item.eraseBox = clampRow(item.eraseBox)
      }
      if (item.specRow) {
        item.lockedFont = item.lockedFont || Math.max(14, Math.min(22, readable))
      } else if (phrase) {
        let font = sizeFont
        const neighbors = drawItems.filter((other) => other !== item).map((other) => other.bbox)
        for (let guard = 0; guard < 28; guard++) {
          const innerW = Math.max(8, item.eraseBox.width - 8)
          const lineH = Math.round(font * 1.15)
          const widthFits = paintLineWidth(font, phrase) <= innerW + 1
          const maxChars = Math.max(1, Math.floor(innerW / Math.max(1, font * 0.62)))
          const wrapped = widthFits ? [phrase] : wrapOverlayWords(phrase, maxChars).slice(0, 2)
          const linesFit = wrapped.length > 0 && wrapped.every((line) => paintLineWidth(font, line) <= innerW + 1)
          const heightFits = linesFit && wrapped.length * lineH + 4 <= item.eraseBox.height + 1
          if (linesFit && heightFits) break
          const atFloor = font <= readable
          if (linesFit && atFloor && !item.tableCell) {
            const needH = Math.min(item.eraseBox.height + 56, wrapped.length * lineH + 8)
            if (needH > item.eraseBox.height + 2) {
              const grown = await growBoxAlongFill(
                imageBuffer,
                item.eraseBox,
                paint.fill,
                neighbors,
                imageWidth,
                imageHeight,
                needH
              )
              if (grown.height > item.eraseBox.height + 2) {
                item.eraseBox = grown
                continue
              }
            }
          }
          const besideNeighbor = neighbors.some((other) => {
            const overlapY =
              Math.min(item.eraseBox.y + item.eraseBox.height, other.y + other.height) -
              Math.max(item.eraseBox.y, other.y)
            if (overlapY < 4) return false
            const gap = Math.max(
              0,
              other.x - (item.eraseBox.x + item.eraseBox.width),
              item.eraseBox.x - (other.x + other.width)
            )
            return gap < 36
          })
          const fontFloor = item.tableCell || besideNeighbor ? 10 : 14
          if (font <= fontFloor) break
          font -= 1
        }
        const besideNeighbor = neighbors.some((other) => {
          const overlapY =
            Math.min(item.eraseBox.y + item.eraseBox.height, other.y + other.height) -
            Math.max(item.eraseBox.y, other.y)
          if (overlapY < 4) return false
          const gap = Math.max(
            0,
            other.x - (item.eraseBox.x + item.eraseBox.width),
            item.eraseBox.x - (other.x + other.width)
          )
          return gap < 36
        })
        item.lockedFont = Math.max(item.tableCell || besideNeighbor ? 10 : 14, font)
      } else {
        const line = Math.max(item.bbox.height, item.eraseBox.height)
        item.lockedFont = Math.max(14, Math.min(48, Math.round(line * 0.72)))
      }
      if (phrase && !item.specRow) {
        const grewLeft = item.eraseBox.x < item.bbox.x - 8
        const grew = item.eraseBox.width > item.bbox.width + 24
        if (grewLeft) {
          item.textAlign = 'start'
          item.textOriginX = Math.round(item.eraseBox.x + 4)
        } else if (grew) {
          item.textAlign = 'start'
          item.textOriginX = Math.round(item.bbox.x)
        } else {
          item.textAlign = 'middle'
        }
      }
    }
  }
  const iconPatches: Array<{ input: Buffer; top: number; left: number }> = []
  const specIconRights: number[] = []
  for (const item of drawItems) {
    if (!item.specRow || !item.eraseBox) continue
    const icon = await leadingIconPatch(imageBuffer, item.eraseBox, imageWidth, imageHeight)
    if (!icon) continue
    iconPatches.push(icon)
    specIconRights.push(icon.left + icon.width)
  }
  if (specIconRights.length) {
    const origin = Math.max(...specIconRights) + 4
    for (const item of drawItems) {
      if (!item.specRow) continue
      item.textOriginX = Math.max(item.textOriginX ?? 0, origin)
    }
  }
  for (const item of drawItems) {
    if (item.lockedFont && item.lockedLines?.length && item.eraseBox) {
      const box = item.eraseBox
      const coversGlyphs =
        box.x <= item.bbox.x + 4 &&
        box.y <= item.bbox.y + 4 &&
        box.x + box.width >= item.bbox.x + item.bbox.width - 4 &&
        box.y + box.height >= item.bbox.y + item.bbox.height - 4
      if (!coversGlyphs) {
        item.lockedLines = undefined
        item.lockedFont = undefined
        item.skipFill = false
        item.eraseBox = undefined
      }
    }
    if (item.lockedFont && item.lockedLines?.length && item.eraseBox) {
      const box = item.eraseBox
      const fontSize = item.lockedFont
      const lineHeight = Math.round(fontSize * 1.15)
      const plateStart = Math.max(
        Math.round(fontSize * 0.8),
        Math.round((box.height - item.lockedLines.length * lineHeight) / 2 + fontSize * 0.75)
      )
      const plateSpans = item.lockedLines
        .map(
          (line, index) =>
            `<tspan x="50%" y="${plateStart + index * lineHeight}">${escapeSvgText(line)}</tspan>`
        )
        .join('')
      const plateSvg = Buffer.from(
        `<svg width="${Math.max(1, Math.round(box.width))}" height="${Math.max(1, Math.round(box.height))}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#ffffff"/>
          <text text-anchor="middle" font-size="${fontSize}" font-family="Arial, sans-serif" fill="${item.drawInk || '#000000'}">${plateSpans}</text>
        </svg>`
      )
      const platePng = await sharp(plateSvg).png().toBuffer()
      backgrounds.push({ input: platePng, top: Math.round(box.y), left: Math.round(box.x) })
      continue
    }
    if (item.eraseBox && !item.tableCell && !item.fillPaint) {
      item.eraseBox = await clampCaptionAbovePhoto(
        imageBuffer,
        item.eraseBox,
        imageWidth,
        imageHeight
      )
    }
    const { bbox, translatedText } = item
    const table = Boolean(item.tableCell)
    const fillMatch = item.fillPaint?.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    const headlineOnLight = fillMatch
      ? 0.299 * Number(fillMatch[1]) + 0.587 * Number(fillMatch[2]) + 0.114 * Number(fillMatch[3]) > 200
      : false
    const banner =
      !table &&
      !headlineOnLight &&
      overlayItemLooksLikeEdgeBanner(item, imageWidth, imageHeight)
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
    const sourceBox = {
      x: Math.max(0, Math.min(imageWidth - 1, Math.round(bbox.x))),
      y: Math.max(0, Math.min(imageHeight - 1, Math.round(bbox.y))),
      width: Math.max(1, Math.min(imageWidth - Math.max(0, Math.round(bbox.x)), Math.round(bbox.width))),
      height: Math.max(1, Math.min(imageHeight - Math.max(0, Math.round(bbox.y)), Math.round(bbox.height))),
    }
    const sourceIsPhoto = await overlayRegionIsProductPhoto(
      imageBuffer,
      sourceBox,
      imageWidth,
      imageHeight
    )
    let coveredPhoto = false
    if (!item.fillPaint && !table && !banner && translatedText.trim()) {
      const patch = await coverDarkGlyphsOnLightPhoto(imageBuffer, sourceBox, imageWidth, imageHeight)
      if (patch) {
        backgrounds.push(patch)
        item.skipFill = true
        item.drawInk = item.drawInk || '#000000'
        coveredPhoto = true
      }
    }
    const photoHeadline =
      !coveredPhoto &&
      !item.fillPaint &&
      !table &&
      !banner &&
      Boolean(translatedText.trim()) &&
      sourceIsPhoto &&
      !overlayBoxCoversProductSubject(sourceBox, imageWidth, imageHeight)
    if (photoHeadline) {
      const phrase = translatedText.trim()
      const neighborBoxes = eraseNeighbors
        .filter((other) => other !== item)
        .map((other) => other.eraseBox ?? other.bbox)
      let rgb: [number, number, number] = [32, 32, 32]
      try {
        rgb = await solidPlateColor(imageBuffer, sourceBox)
      } catch {
        /* nền tối để chữ trắng vẫn đọc được */
      }
      let slot = await measureSameSurfaceSlot(imageBuffer, sourceBox, rgb, neighborBoxes, imageWidth, imageHeight)
      const caption = eraseNeighbors.find(
        (other) =>
          other !== item &&
          Boolean((other.translatedText || '').trim()) &&
          other.bbox.y >= sourceBox.y + sourceBox.height - 2
      )
      if (caption) {
        const card = await findInsetWhiteCard(imageBuffer, caption.bbox, imageWidth, imageHeight)
        const centerX = sourceBox.x + sourceBox.width / 2
        if (card && centerX >= card.x - 12 && centerX <= card.x + card.width + 12 && card.y > sourceBox.y) {
          const gap = 6
          const cardBottom = Math.max(sourceBox.y + sourceBox.height, card.y - gap)
          slot = {
            x: Math.max(slot.x, card.x),
            y: slot.y,
            width: Math.max(sourceBox.width, Math.min(slot.x + slot.width, card.x + card.width) - Math.max(slot.x, card.x)),
            height: Math.max(sourceBox.height, Math.min(slot.y + slot.height, cardBottom) - slot.y),
          }
        }
      }
      const plate = fitSolidPlateLayout(phrase, sourceBox, slot, imageWidth, imageHeight)
      const sourceBottom = sourceBox.y + sourceBox.height
      const plateCoversDiagram = plate.y > sourceBottom + 28 || plate.y + plate.height > sourceBottom + 64
      const coversSource =
        plate.x <= sourceBox.x + 4 &&
        plate.y <= sourceBox.y + 4 &&
        plate.x + plate.width >= sourceBox.x + sourceBox.width - 4 &&
        plate.y + plate.height >= sourceBox.y + sourceBox.height - 4
      if (plateCoversDiagram || !coversSource) {
        /* Tấm chữ trôi khỏi nét Hán hoặc đè sơ đồ. Giữ câu tại ô OCR. */
      } else {
      const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
      const photoColor = luminance > 160 ? '#000000' : '#ffffff'
      const plateStart = Math.max(
        plate.fontSize,
        Math.round((plate.height - plate.lines.length * plate.lineHeight) / 2 + plate.fontSize * 0.82)
      )
      const plateSpans = plate.lines
        .map(
          (line, index) =>
            `<tspan x="50%" y="${plateStart + index * plate.lineHeight}">${escapeSvgText(line)}</tspan>`
        )
        .join('')
      const plateSvg = Buffer.from(
        `<svg width="${plate.width}" height="${plate.height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="rgb(${rgb.join(',')})"/>
          <text text-anchor="middle" font-size="${plate.fontSize}" font-family="Arial, sans-serif" fill="${photoColor}">${plateSpans}</text>
        </svg>`
      )
      const platePng = await sharp(plateSvg).png().toBuffer()
      backgrounds.push({ input: platePng, top: plate.y, left: plate.x })
      continue
      }
    }
    const drawX = x
    const drawY = y
    const drawW = w
    const drawH = h
    if (
      !item.fillPaint &&
      sourceIsPhoto &&
      overlayBoxCoversProductSubject(
        { width: drawW, height: drawH },
        imageWidth,
        imageHeight
      )
    ) {
      continue
    }
    if (
      !item.fillPaint &&
      !translatedText.trim() &&
      item.eraseOriginal &&
      (await overlayRegionIsFlatLightHeader(
        imageBuffer,
        { x: drawX, y: drawY, width: drawW, height: drawH },
        imageWidth,
        imageHeight
      ))
    ) {
      continue
    }
    let fillColor = options?.fillColor ?? '#ffffff'
    let textColor = options?.textColor ?? '#000000'
    let strokeColor = '#ffffff'
    if (banner && options?.sampleBackground && !item.fillPaint) {
      try {
        const rgb = await interiorFillColor(imageBuffer, { x, y, width: w, height: h })
        fillColor = `rgb(${rgb.join(',')})`
        const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
        textColor = luminance > 140 ? '#000000' : '#ffffff'
        strokeColor = textColor === '#ffffff' ? '#000000' : '#ffffff'
      } catch {
        /* fallback to configured colors */
      }
    } else if (item.fillPaint) {
      fillColor = item.fillPaint
      textColor = item.drawInk || textColor
      strokeColor = 'none'
    } else if (options?.sampleBackground) {
      try {
        const band =
          y < imageHeight * 0.1 && h <= 36
            ? await sameBandFillColor(imageBuffer, { x, y, width: w, height: h }, imageWidth)
            : null
        const rgb =
          band ||
          (await surroundingBackgroundColor(
            imageBuffer,
            { x, y, width: w, height: h },
            imageWidth,
            imageHeight
          ))
        fillColor = `rgb(${rgb.join(',')})`
        const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
        textColor = luminance > 140 ? '#000000' : '#ffffff'
        strokeColor = luminance > 140 ? '#ffffff' : '#000000'
      } catch {
        /* fallback to configured colors */
      }
    }
    if (item.drawInk) textColor = item.drawInk
    if (!item.skipFill) {
      const background = Buffer.from(
        `<svg width="${drawW}" height="${drawH}" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="100%" height="100%" fill="${fillColor}"/>
        </svg>`
      )
      backgrounds.push({ input: background, top: drawY, left: drawX })
    }
    if (!translatedText.trim()) continue

    const bannerFit = banner ? fitBannerText(translatedText.trim(), banner.width, banner.height) : null
    const alignStart = item.textAlign === 'start'
    const caption = Boolean(preset && !table && !banner && !alignStart)
    const originPad = item.textOriginX != null ? Math.max(0, Math.round(item.textOriginX - drawX)) : 0
    const measureW = alignStart
      ? Math.max(8, drawW - originPad)
      : caption
        ? Math.min(drawW, Math.max(88, Math.round(bbox.width * 2.2)))
        : drawW
    // Ô bảng giữ khung khóa. Nhãn icon căn giữa trong cột, cỡ gần thẻ trắng.
    const cell = !banner
      ? fitTableCellText(
          translatedText.trim(),
          Math.max(1, measureW),
          Math.max(1, drawH),
          item.lockedFont && !item.lockedLines
            ? item.lockedFont
            : item.skipFill
              ? ocrLineFontSize(bbox.height)
              : caption
                ? 15
                : Math.min(
                    readableOverlayFont(imageWidth),
                    Math.max(16, Math.round(Math.max(bbox.height, drawH) * 0.92))
                  )
        )
      : null
    const posterFit = null
    const labelFit = null
    const drawBox = banner ? banner : { x: drawX, y: drawY, width: drawW, height: drawH }
    const textOutsideErase =
      !table &&
      !banner &&
      (drawBox.x < x || drawBox.y < y || drawBox.x + drawBox.width > x + w || drawBox.y + drawBox.height > y + h)
    if (
      textOutsideErase &&
      !(await overlayRegionIsProductPhoto(imageBuffer, drawBox, imageWidth, imageHeight))
    ) {
      const extra = Buffer.from(
        `<svg width="${drawBox.width}" height="${drawBox.height}" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="100%" height="100%" fill="${fillColor}"/>
        </svg>`
      )
      backgrounds.push({ input: extra, top: drawBox.y, left: drawBox.x })
    }
    const rawWords = translatedText.trim().split(/\s+/).filter(Boolean)
    const maxChars = cell
      ? 0
      : Math.max(
          4,
          Math.floor(drawBox.width / Math.max(6, Math.min(18, drawBox.height * 0.28)))
        )
    const lines = bannerFit
      ? bannerFit.lines
      : cell
      ? cell.lines
      : posterFit
      ? posterFit.lines
      : labelFit
      ? labelFit.lines
      : []
    if (!cell && !bannerFit && !posterFit && !labelFit) {
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
    let fontSize = bannerFit
      ? bannerFit.fontSize
      : cell
      ? cell.fontSize
      : posterFit
      ? posterFit.fontSize
      : labelFit
      ? labelFit.fontSize
      : Math.max(
          MIN_LOCALIZED_FONT_SIZE,
          Math.min(
            140,
            Math.floor((drawBox.height * 0.78) / lineCount),
            Math.floor(drawBox.width / Math.max(1, maxChars * 0.52))
          )
        )
    let lineHeight = bannerFit
      ? bannerFit.lineHeight
      : cell
        ? cell.lineHeight
        : posterFit
          ? posterFit.lineHeight
          : labelFit
            ? labelFit.lineHeight
        : Math.max(9, Math.round(fontSize * 1.12))
    const anchorX = bannerFit
      ? bannerFit.padX
      : alignStart
        ? originPad + (cell?.padX ?? 2)
        : caption
          ? '50%'
          : cell
            ? cell.padX
            : '50%'
    const fittedInBox = Boolean((cell && !caption) || bannerFit || alignStart)
    const strokeWidth = fittedInBox || caption ? 0 : fontSize < 24 ? 1 : Math.min(3, Math.max(1, Math.round(fontSize * 0.05)))
    let textBox = drawBox
    if (!table && !banner && lines.length === 1 && lines[0]) {
      const pad = typeof anchorX === 'number' ? anchorX + 2 : 6
      const needed = Math.ceil(paintLineWidth(fontSize, lines[0]) + pad)
      if (needed > textBox.width + 1) {
        let limit = Math.min(imageWidth - textBox.x - 2, needed)
        for (const other of eraseNeighbors) {
          if (other === item) continue
          const otherBox = other.eraseBox ?? other.bbox
          const overlapY =
            Math.min(textBox.y + textBox.height, otherBox.y + otherBox.height) - Math.max(textBox.y, otherBox.y)
          if (overlapY < 4 || otherBox.x <= textBox.x + 4) continue
          limit = Math.min(limit, otherBox.x - textBox.x - 4)
        }
        if (limit > textBox.width + 1) {
          const strip = {
            x: textBox.x + textBox.width,
            y: textBox.y,
            width: limit - textBox.width,
            height: textBox.height,
          }
          const photo =
            strip.width >= 8 && strip.height >= 8
              ? await overlayRegionIsProductPhoto(imageBuffer, strip, imageWidth, imageHeight)
              : false
          if (!photo || item.skipFill) textBox = { ...textBox, width: limit }
        }
      }
    }
    if ((cell || item.skipFill) && lines.length) {
      const pad = typeof anchorX === 'number' ? anchorX + 2 : 4
      const innerW = Math.max(8, textBox.width - pad)
      while (
        fontSize > MIN_LOCALIZED_FONT_SIZE &&
        lines.some((line) => paintLineWidth(fontSize, line) > innerW + 1)
      ) {
        fontSize -= 1
        lineHeight = Math.max(fontSize, Math.round(fontSize * 1.08))
      }
    }
    const fittedStart = Math.max(
      fontSize,
      Math.round((textBox.height - lineHeight * Math.max(1, lines.length)) / 2 + fontSize * 0.8)
    )
    const fittedSpans = (lines.length ? lines : translatedText.trim() ? [translatedText.trim()] : [])
      .map(
        (line, index) =>
          `<tspan x="${anchorX}" y="${fittedStart + index * lineHeight}">${escapeSvgText(line)}</tspan>`
      )
      .join('')

    const svg = Buffer.from(
      `<svg width="${textBox.width}" height="${textBox.height}" xmlns="http://www.w3.org/2000/svg">
        <text text-anchor="${fittedInBox ? 'start' : 'middle'}" font-size="${fontSize}" font-family="Arial, sans-serif"
          fill="${textColor}" stroke="${fittedInBox || caption ? 'none' : strokeColor}" stroke-width="${strokeWidth}"
          paint-order="stroke fill">${fittedSpans}</text>
      </svg>`
    )
    const textPng = await sharp(svg)
      .resize(textBox.width, textBox.height, { fit: 'cover', position: 'left top' })
      .png()
      .toBuffer()

    texts.push({ input: textPng, top: textBox.y, left: textBox.x })
  }

  const layers: Array<{ input: Buffer; top: number; left: number }> = []
  for (const layer of [...backgrounds, ...iconPatches, ...texts]) {
    const meta = await sharp(layer.input).metadata()
    const width = meta.width || 0
    const height = meta.height || 0
    if (width < 1 || height < 1) continue
    if (width > imageWidth || height > imageHeight) {
      const fitted = await sharp(layer.input)
        .extract({
          left: 0,
          top: 0,
          width: Math.min(width, imageWidth),
          height: Math.min(height, imageHeight),
        })
        .png()
        .toBuffer()
      layers.push({
        input: fitted,
        left: Math.max(0, Math.round(layer.left)),
        top: Math.max(0, Math.round(layer.top)),
      })
      continue
    }
    const left = Math.round(layer.left)
    const top = Math.round(layer.top)
    if (left >= imageWidth || top >= imageHeight || left + width <= 0 || top + height <= 0) continue
    layers.push({ input: layer.input, left, top })
  }
  return sharp(imageBuffer).composite(layers).png().toBuffer()
}
