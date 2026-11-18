import sharp from 'sharp'
import type { BoxFaceSlot } from '@/lib/packaging/box-face-slots'
import type { TuckEndLayoutData } from '@/lib/packaging/box-net-svg'

export type DielineWarning = { code: string; message: string }

const SLOT_LABEL: Record<BoxFaceSlot, string> = {
  top: 'nắp',
  front: 'mặt trước',
  right: 'hông phải',
  bottom: 'đáy',
  back: 'mặt sau',
  left: 'hông trái',
}

export function dielineWarningMessage(code: string): string {
  if (code.startsWith('finger-notch:')) {
    const slot = code.slice('finger-notch:'.length) as BoxFaceSlot
    return `Khoét ngón tay có thể cắt vào chữ hoặc logo trên ${SLOT_LABEL[slot] ?? 'mặt hộp'}.`
  }
  if (code.startsWith('safe-zone:')) {
    const slot = code.slice('safe-zone:'.length) as BoxFaceSlot
    return `Chữ hoặc khung viền trên ${SLOT_LABEL[slot] ?? 'mặt hộp'} nằm trong vùng an toàn.`
  }
  return code
}

function mmPx(mm: number, dpi: number): number {
  return Math.max(0, Math.round((mm * dpi) / 25.4))
}

function rangesOverlap(a: number, aSpan: number, b: number, bSpan: number): boolean {
  return a < b + bSpan - 0.4 && b < a + aSpan - 0.4
}

function neutralGray(r: number, g: number, b: number, light = true): boolean {
  const lum = (r + g + b) / 3
  const chroma = Math.max(r, g, b) - Math.min(r, g, b)
  if (chroma >= 16) return false
  return light ? lum > 168 && lum < 214 : lum > 40 && lum < 214
}

async function stripTopGrayBar(png: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const width = info.width
  const height = info.height
  if (!width || !height) return png
  const rowGray = (y: number) => {
    let gray = 0
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3
      if (neutralGray(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0)) gray += 1
    }
    return gray / width
  }
  let rows = 0
  while (rows < height && rowGray(rows) > 0.9) rows += 1
  const fraction = rows / height
  if (rows < 3 || fraction < 0.06 || fraction > 0.34) return png
  if (rows + 2 < height && rowGray(rows + 2) > 0.9) return png
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3
      data[i] = 255
      data[i + 1] = 255
      data[i + 2] = 255
    }
  }
  return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer()
}

async function whitenNeutralEdge(png: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const width = info.width
  const height = info.height
  if (width < 4 || height < 4) return png
  const paint = (x: number, y: number) => {
    const i = (y * width + x) * 3
    if (!neutralGray(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0, false)) return
    data[i] = 255
    data[i + 1] = 255
    data[i + 2] = 255
  }
  for (let y = 0; y < height; y += 1) {
    paint(0, y)
    paint(width - 1, y)
  }
  for (let x = 0; x < width; x += 1) {
    paint(x, 0)
    paint(x, height - 1)
  }
  return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer()
}

async function coverFit(
  buffer: Buffer,
  widthPx: number,
  heightPx: number,
  rotation: number,
  fit: 'contain' | 'cover' = 'contain'
): Promise<Buffer> {
  const pipeline = sharp(buffer, { limitInputPixels: false }).rotate()
  if (rotation) pipeline.rotate(rotation)
  return pipeline
    .resize(Math.max(1, widthPx), Math.max(1, heightPx), {
      fit,
      position: 'centre',
      background: { r: 255, g: 255, b: 255 },
    })
    .png()
    .toBuffer()
}

async function fitWindowBands(
  buffer: Buffer,
  widthPx: number,
  heightPx: number,
  topPx: number,
  bottomPx: number
): Promise<Buffer> {
  const meta = await sharp(buffer).metadata()
  const srcW = meta.width ?? widthPx
  const srcH = meta.height ?? heightPx
  const midPx = Math.max(1, heightPx - topPx - bottomPx)
  const topSrc = Math.max(1, Math.round(srcH * 0.32))
  const botSrc = Math.max(1, Math.round(srcH * 0.28))
  const midTop = Math.min(srcH - 2, Math.round(srcH * 0.3))
  const midH = Math.max(1, srcH - midTop - Math.round(srcH * 0.22))
  const band = async (top: number, height: number, outH: number) =>
    sharp(buffer)
      .extract({ left: 0, top, width: srcW, height: Math.max(1, Math.min(height, srcH - top)) })
      .resize(widthPx, Math.max(1, outH), { fit: 'cover', position: 'centre' })
      .png()
      .toBuffer()
  const layers: sharp.OverlayOptions[] = []
  if (topPx > 1) layers.push({ input: await band(0, topSrc, topPx), left: 0, top: 0 })
  layers.push({ input: await band(midTop, midH, midPx), left: 0, top: topPx })
  if (bottomPx > 1) layers.push({ input: await band(srcH - botSrc, botSrc, bottomPx), left: 0, top: topPx + midPx })
  return sharp({
    create: { width: widthPx, height: heightPx, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(layers)
    .png()
    .toBuffer()
}

async function whitePng(widthPx: number, heightPx: number): Promise<Buffer> {
  return sharp({
    create: {
      width: Math.max(1, widthPx),
      height: Math.max(1, heightPx),
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toBuffer()
}

async function sliceBodyStrip(
  buffer: Buffer,
  lengthMm: number,
  widthMm: number,
  heightMm: number,
  dpi: number
): Promise<Partial<Record<BoxFaceSlot, Buffer>>> {
  const widths = [lengthMm, widthMm, lengthMm, widthMm]
  const total = widths.reduce((sum, item) => sum + item, 0)
  const totalPx = Math.max(4, mmPx(total, dpi))
  const heightPx = Math.max(1, mmPx(heightMm, dpi))
  const fitted = await coverFit(buffer, totalPx, heightPx, 0)
  const slots: BoxFaceSlot[] = ['front', 'right', 'back', 'left']
  const out: Partial<Record<BoxFaceSlot, Buffer>> = {}
  let x = 0
  for (let i = 0; i < slots.length; i += 1) {
    const wPx = i === slots.length - 1 ? totalPx - x : Math.max(1, Math.round((totalPx * widths[i]!) / total))
    out[slots[i]!] = await sharp(fitted).extract({ left: x, top: 0, width: wPx, height: heightPx }).png().toBuffer()
    x += wPx
  }
  return out
}

function padForPanel(
  panel: TuckEndLayoutData['panels'][number],
  layout: TuckEndLayoutData,
  bleedMm: number
): { left: number; right: number; top: number; bottom: number } {
  const pad = { left: bleedMm, right: bleedMm, top: bleedMm, bottom: bleedMm }
  const glue = layout.glueRects ?? []
  const touches = (side: 'left' | 'right' | 'top' | 'bottom') =>
    glue.some((rect) => {
      if (side === 'right') {
        return Math.abs(rect.x - (panel.x + panel.w)) < 1.2 && rangesOverlap(rect.y, rect.h, panel.y, panel.h)
      }
      if (side === 'left') {
        return Math.abs(rect.x + rect.w - panel.x) < 1.2 && rangesOverlap(rect.y, rect.h, panel.y, panel.h)
      }
      if (side === 'bottom') {
        return Math.abs(rect.y - (panel.y + panel.h)) < 1.2 && rangesOverlap(rect.x, rect.w, panel.x, panel.w)
      }
      return Math.abs(rect.y + rect.h - panel.y) < 1.2 && rangesOverlap(rect.x, rect.w, panel.x, panel.w)
    })
  const touchesPanel = (side: 'left' | 'right' | 'top' | 'bottom') =>
    layout.panels.some((other) => {
      if (other === panel) return false
      if (side === 'right') {
        return Math.abs(other.x - (panel.x + panel.w)) < 1.2 && rangesOverlap(other.y, other.h, panel.y, panel.h)
      }
      if (side === 'left') {
        return Math.abs(other.x + other.w - panel.x) < 1.2 && rangesOverlap(other.y, other.h, panel.y, panel.h)
      }
      if (side === 'bottom') {
        return Math.abs(other.y - (panel.y + panel.h)) < 1.2 && rangesOverlap(other.x, other.w, panel.x, panel.w)
      }
      return Math.abs(other.y + other.h - panel.y) < 1.2 && rangesOverlap(other.x, other.w, panel.x, panel.w)
    })
  if (touches('left') || touchesPanel('left')) pad.left = 0
  if (touches('right') || touchesPanel('right')) pad.right = 0
  if (touches('top') || touchesPanel('top')) pad.top = 0
  if (touches('bottom') || touchesPanel('bottom')) pad.bottom = 0
  return pad
}

function stats(data: Buffer, width: number, x0: number, y0: number, x1: number, y1: number) {
  let sum = 0
  let sumSq = 0
  let count = 0
  const yStart = Math.max(0, y0)
  const yEnd = Math.min(Math.floor(data.length / (width * 3) ), y1)
  const xStart = Math.max(0, x0)
  const xEnd = Math.min(width, x1)
  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const i = (y * width + x) * 3
      const lum = (data[i]! + data[i + 1]! + data[i + 2]!) / 3
      sum += lum
      sumSq += lum * lum
      count += 1
    }
  }
  if (!count) return { mean: 255, variance: 0 }
  const mean = sum / count
  return { mean, variance: Math.max(0, sumSq / count - mean * mean) }
}

async function warningsForPanel(
  png: Buffer,
  panel: TuckEndLayoutData['panels'][number],
  safeZoneMm: number,
  notches: NonNullable<TuckEndLayoutData['fingerNotches']>
): Promise<DielineWarning[]> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const width = info.width
  const height = info.height
  const shortest = Math.min(panel.w, panel.h)
  const safePx = Math.max(2, Math.min(Math.floor(Math.min(width, height) / 4), Math.round((Math.min(width, height) * safeZoneMm) / shortest)))
  const ring = stats(data, width, 0, 0, width, height)
  const interior = stats(data, width, safePx, safePx, width - safePx, height - safePx)
  const edgeBand = {
    mean: 0,
    variance: 0,
  }
  const topBand = stats(data, width, 0, 0, width, safePx)
  const bottomBand = stats(data, width, 0, height - safePx, width, height)
  const leftBand = stats(data, width, 0, 0, safePx, height)
  const rightBand = stats(data, width, width - safePx, 0, width, height)
  const bands = [topBand, bottomBand, leftBand, rightBand]
  edgeBand.mean = bands.reduce((sum, item) => sum + item.mean, 0) / bands.length
  edgeBand.variance = bands.reduce((sum, item) => sum + item.variance, 0) / bands.length
  void ring
  const out: DielineWarning[] = []
  const framed = Math.abs(edgeBand.mean - interior.mean) > 28 && edgeBand.variance < 220 && interior.variance < 500
  const textNearEdge = edgeBand.variance > 500 && interior.variance < 220
  if (framed || textNearEdge) {
    const code = `safe-zone:${panel.slot}`
    out.push({ code, message: dielineWarningMessage(code) })
  }
  for (const notch of notches) {
    if (notch.slot !== panel.slot) continue
    const band = Math.max(3, Math.round(height * 0.12))
    const region =
      notch.edge === 'bottom'
        ? stats(data, width, 0, height - band, width, height)
        : notch.edge === 'left'
          ? stats(data, width, 0, 0, band, height)
          : notch.edge === 'right'
            ? stats(data, width, width - band, 0, width, height)
            : stats(data, width, 0, 0, width, band)
    const center = stats(data, width, Math.floor(width * 0.25), Math.floor(height * 0.25), Math.floor(width * 0.75), Math.floor(height * 0.75))
    const hits =
      (Math.abs(region.mean - center.mean) > 35 && center.variance < 350) ||
      (region.variance > 650 && center.variance < 220)
    if (hits) {
      const code = `finger-notch:${panel.slot}`
      out.push({ code, message: dielineWarningMessage(code) })
    }
  }
  return out
}

export async function composeDielineRaster(input: {
  layout: TuckEndLayoutData
  slotBuffers: Partial<Record<BoxFaceSlot, Buffer>>
  bodyStripBuffer?: Buffer
  boxLengthMm: number
  boxWidthMm: number
  boxHeightMm: number
  bleedMm: number
  dpi: number
  safeZoneMm: number
}): Promise<{ png: Buffer; warnings: DielineWarning[] }> {
  const { layout, bleedMm, dpi } = input
  const widthPx = Math.max(1, mmPx(layout.bounds.widthMm + bleedMm * 2, dpi))
  const heightPx = Math.max(1, mmPx(layout.bounds.heightMm + bleedMm * 2, dpi))
  let slots = { ...input.slotBuffers }
  if (input.bodyStripBuffer && layout.bodyStrip) {
    const sliced = await sliceBodyStrip(
      input.bodyStripBuffer,
      input.boxLengthMm,
      input.boxWidthMm,
      input.boxHeightMm,
      dpi
    )
    slots = { ...slots, ...sliced }
  }
  const prepared: Array<{ exact: Buffer; extended: Buffer; left: number; top: number; exactLeft: number; exactTop: number }> = []
  const warnings: DielineWarning[] = []
  for (const panel of layout.panels) {
    const wPx = Math.max(1, mmPx(panel.w, dpi))
    const hPx = Math.max(1, mmPx(panel.h, dpi))
    const raw = await stripTopGrayBar(slots[panel.slot] ?? (await whitePng(wPx, hPx)))
    const hole = (layout.knockouts ?? []).find(
      (item) =>
        item.kind === 'window' &&
        item.x < panel.x + panel.w - 1 &&
        item.x + item.w > panel.x + 1 &&
        item.y < panel.y + panel.h - 1 &&
        item.y + item.h > panel.y + 1
    )
    const turned = sharp(raw).rotate()
    if (panel.rotation) turned.rotate(panel.rotation)
    const turnedPng = await turned.png().toBuffer()
    const fitted = hole
      ? await fitWindowBands(
          turnedPng,
          wPx,
          hPx,
          Math.max(0, mmPx(hole.y - panel.y, dpi)),
          Math.max(0, mmPx(panel.y + panel.h - (hole.y + hole.h), dpi))
        )
      : await coverFit(raw, wPx, hPx, panel.rotation ?? 0, panel.fit ?? 'contain')
    const exact = await whitenNeutralEdge(fitted)
    const pad = padForPanel(panel, layout, bleedMm)
    const extended = await sharp(exact)
      .extend({
        left: mmPx(pad.left, dpi),
        right: mmPx(pad.right, dpi),
        top: mmPx(pad.top, dpi),
        bottom: mmPx(pad.bottom, dpi),
        extendWith: 'copy',
        background: { r: 255, g: 255, b: 255 },
      })
      .png()
      .toBuffer()
    prepared.push({
      exact,
      extended,
      left: Math.max(0, mmPx(bleedMm + panel.x - pad.left, dpi)),
      top: Math.max(0, mmPx(bleedMm + panel.y - pad.top, dpi)),
      exactLeft: mmPx(bleedMm + panel.x, dpi),
      exactTop: mmPx(bleedMm + panel.y, dpi),
    })
    warnings.push(
      ...(await warningsForPanel(exact, panel, input.safeZoneMm, layout.fingerNotches ?? []))
    )
  }
  const knockout = knockoutSvg(widthPx, heightPx, layout, bleedMm, dpi)
  const png = await sharp({
    create: { width: widthPx, height: heightPx, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      ...prepared.map((item) => ({ input: item.extended, left: item.left, top: item.top })),
      ...prepared.map((item) => ({ input: item.exact, left: item.exactLeft, top: item.exactTop })),
      ...(knockout ? [{ input: Buffer.from(knockout), left: 0, top: 0 }] : []),
    ])
    .png()
    .toBuffer()
  return { png, warnings }
}

function knockoutSvg(
  widthPx: number,
  heightPx: number,
  layout: TuckEndLayoutData,
  bleedMm: number,
  dpi: number
): string | null {
  const shapes: string[] = []
  const rects = [
    ...(layout.glueRects ?? []).map((rect) => ({ ...rect, shape: 'rect' as const })),
    ...(layout.knockouts ?? []),
  ]
  for (const rect of rects) {
    const x = mmPx(bleedMm + rect.x, dpi)
    const y = mmPx(bleedMm + rect.y, dpi)
    const w = Math.max(1, mmPx(rect.w, dpi))
    const h = Math.max(1, mmPx(rect.h, dpi))
    if ('shape' in rect && rect.shape === 'ellipse') {
      shapes.push(`<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="#ffffff"/>`)
    } else {
      shapes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>`)
    }
  }
  if (!shapes.length) return null
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}">${shapes.join('')}</svg>`
}
