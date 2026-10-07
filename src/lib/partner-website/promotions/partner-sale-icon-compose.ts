import sharp from 'sharp'
import {
  PARTNER_SALE_ICON_PX,
  partnerSaleIconDateLabel,
} from '@/lib/partner-website/promotions/partner-sale-icon'

/** 3×5 block digits. Fat strokes stay readable when the icon shrinks to a tab. */
const GLYPHS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
}

const COLS = 3
const ROWS = 5
const BAND_RATIO = 0.44
const GAP_RATIO = 0.45

export type PartnerSaleIconGlyphRect = { x: number; y: number; w: number; h: number }
export type PartnerSaleIconSlash = { x1: number; y1: number; x2: number; y2: number; stroke: number }

type DateMarks = { rects: PartnerSaleIconGlyphRect[]; slashes: PartnerSaleIconSlash[] }

export function partnerSaleIconDateBand(size: number): { top: number; height: number } {
  const height = Math.max(ROWS, Math.round(size * BAND_RATIO))
  return { top: Math.max(0, size - height), height }
}

/** White date blocks on the bottom band. Width tracks the square so 10/10 is not a corner chip. */
export function partnerSaleIconDateMarks(size: number, label: string): DateMarks {
  const glyphs = [...label].filter((ch) => ch === '/' || GLYPHS[ch])
  if (!glyphs.length || size < 16) return { rects: [], slashes: [] }
  const band = partnerSaleIconDateBand(size)
  const pad = Math.max(2, Math.round(size * 0.04))
  const innerW = Math.max(1, size - pad * 2)
  const units = glyphs.length * COLS + (glyphs.length - 1) * GAP_RATIO
  let cell = Math.max(1, Math.floor(innerW / units))
  const maxH = Math.max(ROWS, Math.floor(band.height * 0.78))
  if (cell * ROWS > maxH) cell = Math.max(1, Math.floor(maxH / ROWS))
  const gap = Math.max(1, Math.round(cell * GAP_RATIO))
  const glyphW = COLS * cell
  const glyphH = ROWS * cell
  const totalW = glyphs.length * glyphW + (glyphs.length - 1) * gap
  let x = Math.round((size - totalW) / 2)
  const y0 = band.top + Math.round((band.height - glyphH) / 2)
  const marks: DateMarks = { rects: [], slashes: [] }
  for (const ch of glyphs) {
    if (ch === '/') {
      const stroke = Math.max(2, Math.round(cell * 1.35))
      const inset = Math.max(1, Math.round(stroke / 2))
      marks.slashes.push({
        x1: x + glyphW - inset,
        y1: y0 + inset,
        x2: x + inset,
        y2: y0 + glyphH - inset,
        stroke,
      })
    } else {
      const rows = GLYPHS[ch]
      for (let r = 0; r < ROWS; r += 1) {
        const bits = rows[r] || ''
        for (let c = 0; c < COLS; c += 1) {
          if (bits[c] !== '1') continue
          marks.rects.push({ x: x + c * cell, y: y0 + r * cell, w: cell, h: cell })
        }
      }
    }
    x += glyphW + gap
  }
  return marks
}

export function partnerSaleIconDateGlyphRects(size: number, label: string): PartnerSaleIconGlyphRect[] {
  return partnerSaleIconDateMarks(size, label).rects
}

export function partnerSaleIconDateBandSvg(size: number, label: string): string {
  const band = partnerSaleIconDateBand(size)
  const marks = partnerSaleIconDateMarks(size, label)
  const blocks = marks.rects
    .map(
      (rect) =>
        `<rect x="${rect.x}" y="${rect.y - band.top}" width="${rect.w}" height="${rect.h}" fill="#ffffff"/>`
    )
    .join('')
  const slashes = marks.slashes
    .map(
      (slash) =>
        `<line x1="${slash.x1}" y1="${slash.y1 - band.top}" x2="${slash.x2}" y2="${slash.y2 - band.top}" stroke="#ffffff" stroke-width="${slash.stroke}" stroke-linecap="square"/>`
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${band.height}"><rect width="100%" height="100%" fill="#111827"/>${blocks}${slashes}</svg>`
}

/**
 * Keep the shop mark unchanged (no AI redraw) and paint day/month as a full-width
 * black band with large white block digits.
 */
export async function composePartnerSaleIconPng(input: {
  mark: Buffer
  day: number
  month: number
  size?: number
}): Promise<Buffer> {
  const size = input.size && input.size >= 32 ? Math.round(input.size) : PARTNER_SALE_ICON_PX
  const band = partnerSaleIconDateBand(size)
  const logoSide = Math.max(8, Math.min(Math.round(size * 0.9), Math.round(band.top * 0.96)))
  const trimmed = await sharp(input.mark)
    .ensureAlpha()
    .trim({ threshold: 18 })
    .png()
    .toBuffer()
    .catch(() => input.mark)
  const logo = await sharp(trimmed)
    .ensureAlpha()
    .resize(logoSide, logoSide, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer()
  const bandPng = await sharp(Buffer.from(partnerSaleIconDateBandSvg(size, partnerSaleIconDateLabel(input.day, input.month))))
    .png()
    .toBuffer()
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      { input: logo, left: Math.round((size - logoSide) / 2), top: Math.round((band.top - logoSide) / 2) },
      { input: bandPng, left: 0, top: band.top },
    ])
    .png()
    .toBuffer()
}
