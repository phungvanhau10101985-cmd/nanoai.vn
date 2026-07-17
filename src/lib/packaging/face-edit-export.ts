export type FaceEditTextOverlay = {
  id: string
  kind: 'text'
  /** Normalized position within crop (0–1). */
  nx: number
  ny: number
  text: string
  /** Font size as fraction of crop height. */
  fontSizeRatio: number
  color: string
}

export type FaceEditImageOverlay = {
  id: string
  kind: 'image' | 'sticker'
  nx: number
  ny: number
  nw: number
  nh: number
  src: string
}

export type FaceEditOverlay = FaceEditTextOverlay | FaceEditImageOverlay

export type FaceEditCropRect = { x: number; y: number; width: number; height: number }

export type ImageEdgeColors = {
  left: string
  right: string
  top: string
  bottom: string
  average: string
}

type Rgb = { r: number; g: number; b: number }

const EDGE_SAMPLE_PX = 4

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new window.Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('load image failed'))
    el.src = src
  })
}

function rgbToCss({ r, g, b }: Rgb): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

function avgRgb(samples: Rgb[]): Rgb {
  if (!samples.length) return { r: 255, g: 255, b: 255 }
  let r = 0
  let g = 0
  let b = 0
  for (const s of samples) {
    r += s.r
    g += s.g
    b += s.b
  }
  const n = samples.length
  return { r: r / n, g: g / n, b: b / n }
}

function readImagePixels(img: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

function sampleStrip(
  data: ImageData,
  x0: number,
  y0: number,
  w: number,
  h: number
): Rgb[] {
  const out: Rgb[] = []
  const xEnd = Math.min(data.width, x0 + w)
  const yEnd = Math.min(data.height, y0 + h)
  for (let y = y0; y < yEnd; y++) {
    for (let x = x0; x < xEnd; x++) {
      const i = (y * data.width + x) * 4
      const a = data.data[i + 3] ?? 255
      if (a < 16) continue
      out.push({
        r: data.data[i] ?? 255,
        g: data.data[i + 1] ?? 255,
        b: data.data[i + 2] ?? 255,
      })
    }
  }
  return out
}

/** Average colors along each image edge — used to fill letterbox gaps. */
export function extractImageEdgeColors(img: HTMLImageElement): ImageEdgeColors {
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (w <= 0 || h <= 0) {
    const white = 'rgb(255, 255, 255)'
    return { left: white, right: white, top: white, bottom: white, average: white }
  }

  const data = readImagePixels(img)
  const stripW = Math.min(EDGE_SAMPLE_PX, w)
  const stripH = Math.min(EDGE_SAMPLE_PX, h)

  const left = avgRgb(sampleStrip(data, 0, 0, stripW, h))
  const right = avgRgb(sampleStrip(data, w - stripW, 0, stripW, h))
  const top = avgRgb(sampleStrip(data, 0, 0, w, stripH))
  const bottom = avgRgb(sampleStrip(data, 0, h - stripH, w, stripH))
  const average = avgRgb([left, right, top, bottom])

  return {
    left: rgbToCss(left),
    right: rgbToCss(right),
    top: rgbToCss(top),
    bottom: rgbToCss(bottom),
    average: rgbToCss(average),
  }
}

export async function loadImageEdgeColors(imageUrl: string): Promise<ImageEdgeColors> {
  const img = await loadImage(imageUrl)
  return extractImageEdgeColors(img)
}

function fillCropGapRegions(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  imgW: number,
  imgH: number,
  crop: FaceEditCropRect,
  colors: ImageEdgeColors
): void {
  const destX = Math.max(0, -crop.x)
  const destY = Math.max(0, -crop.y)
  const drawW = Math.min(imgW, crop.x + crop.width) - Math.max(0, crop.x)
  const drawH = Math.min(imgH, crop.y + crop.height) - Math.max(0, crop.y)
  const imgLeft = destX
  const imgTop = destY
  const imgRight = destX + Math.max(0, drawW)
  const imgBottom = destY + Math.max(0, drawH)

  if (imgLeft > 0) {
    ctx.fillStyle = colors.left
    ctx.fillRect(0, 0, imgLeft, canvasH)
  }
  if (imgRight < canvasW) {
    ctx.fillStyle = colors.right
    ctx.fillRect(imgRight, 0, canvasW - imgRight, canvasH)
  }
  if (imgTop > 0) {
    ctx.fillStyle = colors.top
    ctx.fillRect(imgLeft, 0, Math.max(0, imgRight - imgLeft), imgTop)
  }
  if (imgBottom < canvasH) {
    ctx.fillStyle = colors.bottom
    ctx.fillRect(imgLeft, imgBottom, Math.max(0, imgRight - imgLeft), canvasH - imgBottom)
  }
}

export async function exportFaceEditBlob(
  imageUrl: string,
  crop: FaceEditCropRect,
  overlays: FaceEditOverlay[],
  options?: { fillGapsWithEdgeColor?: boolean }
): Promise<Blob> {
  const base = await loadImage(imageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(crop.width))
  canvas.height = Math.max(1, Math.round(crop.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  const fillEdge = options?.fillGapsWithEdgeColor ?? false
  const edgeColors = fillEdge ? extractImageEdgeColors(base) : null

  if (fillEdge && edgeColors) {
    fillCropGapRegions(ctx, canvas.width, canvas.height, base.naturalWidth, base.naturalHeight, crop, edgeColors)
  } else {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const imgW = base.naturalWidth
  const imgH = base.naturalHeight
  const srcLeft = Math.max(0, crop.x)
  const srcTop = Math.max(0, crop.y)
  const srcRight = Math.min(imgW, crop.x + crop.width)
  const srcBottom = Math.min(imgH, crop.y + crop.height)

  if (srcRight > srcLeft && srcBottom > srcTop) {
    const destX = srcLeft - crop.x
    const destY = srcTop - crop.y
    ctx.drawImage(
      base,
      srcLeft,
      srcTop,
      srcRight - srcLeft,
      srcBottom - srcTop,
      destX,
      destY,
      srcRight - srcLeft,
      srcBottom - srcTop
    )
  }

  for (const layer of overlays) {
    if (layer.kind === 'text') {
      const fontPx = Math.max(8, Math.round(layer.fontSizeRatio * canvas.height))
      ctx.font = `600 ${fontPx}px system-ui, sans-serif`
      ctx.fillStyle = layer.color
      ctx.textBaseline = 'top'
      ctx.fillText(layer.text, layer.nx * canvas.width, layer.ny * canvas.height)
      continue
    }
    const img = await loadImage(layer.src)
    ctx.drawImage(
      img,
      layer.nx * canvas.width,
      layer.ny * canvas.height,
      layer.nw * canvas.width,
      layer.nh * canvas.height
    )
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
}

export type OutpaintMergeOptions = {
  /** Horizontal/vertical alpha feather where original meets AI background. */
  featherPx?: number
  /** Extra color blend band at seam lines (px). */
  seamHealPx?: number
}

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)))
}

function drawOriginalSliceWithFeather(
  ctx: CanvasRenderingContext2D,
  original: HTMLImageElement,
  srcLeft: number,
  srcTop: number,
  sliceW: number,
  sliceH: number,
  destX: number,
  destY: number,
  feather: { left: number; right: number; top: number; bottom: number }
): void {
  const patch = document.createElement('canvas')
  patch.width = Math.max(1, sliceW)
  patch.height = Math.max(1, sliceH)
  const pctx = patch.getContext('2d')
  if (!pctx) throw new Error('canvas')
  pctx.drawImage(original, srcLeft, srcTop, sliceW, sliceH, 0, 0, sliceW, sliceH)

  const { left, right, top, bottom } = feather
  if (left > 0 || right > 0 || top > 0 || bottom > 0) {
    const data = pctx.getImageData(0, 0, sliceW, sliceH)
    const d = data.data
    for (let y = 0; y < sliceH; y++) {
      let alphaY = 1
      if (top > 0 && y < top) alphaY = y / top
      else if (bottom > 0 && y >= sliceH - bottom) alphaY = (sliceH - 1 - y) / bottom
      for (let x = 0; x < sliceW; x++) {
        let alphaX = 1
        if (left > 0 && x < left) alphaX = x / left
        else if (right > 0 && x >= sliceW - right) alphaX = (sliceW - 1 - x) / right
        const i = (y * sliceW + x) * 4
        d[i + 3] = Math.round((d[i + 3] ?? 255) * Math.min(alphaX, alphaY))
      }
    }
    pctx.putImageData(data, 0, 0)
  }

  ctx.drawImage(patch, destX, destY)
}

/** Blend colors along vertical seam lines to soften AI ↔ original transitions. */
function healVerticalSeams(
  ctx: CanvasRenderingContext2D,
  seamXs: number[],
  healPx: number
): void {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  if (w <= 0 || h <= 0 || healPx <= 0) return
  const data = ctx.getImageData(0, 0, w, h)
  const px = data.data
  const half = Math.max(2, Math.floor(healPx / 2))

  for (const seamX of seamXs) {
    const center = clampInt(seamX, 0, w - 1)
    const x0 = Math.max(0, center - half)
    const x1 = Math.min(w - 1, center + half)
    const sampleLeft = Math.max(0, x0 - 3)
    const sampleRight = Math.min(w - 1, x1 + 3)
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / Math.max(1, x1 - x0)
      for (let y = 0; y < h; y++) {
        const row = y * w
        const li = (row + sampleLeft) * 4
        const ri = (row + sampleRight) * 4
        const oi = (row + x) * 4
        px[oi] = Math.round(px[li]! * (1 - t) + px[ri]! * t)
        px[oi + 1] = Math.round(px[li + 1]! * (1 - t) + px[ri + 1]! * t)
        px[oi + 2] = Math.round(px[li + 2]! * (1 - t) + px[ri + 2]! * t)
      }
    }
  }
  ctx.putImageData(data, 0, 0)
}

/** After AI outpaint, paste original image pixels back so text/product are not regenerated. */
export async function mergeOutpaintWithOriginalRegion(
  outpaintUrl: string,
  originalImageUrl: string,
  crop: FaceEditCropRect,
  options?: OutpaintMergeOptions
): Promise<string> {
  const [aiImg, original] = await Promise.all([loadImage(outpaintUrl), loadImage(originalImageUrl)])
  const targetW = Math.max(1, Math.round(crop.width))
  const targetH = Math.max(1, Math.round(crop.height))
  const featherPx = options?.featherPx ?? 40
  const seamHealPx = options?.seamHealPx ?? 24

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')

  ctx.drawImage(aiImg, 0, 0, targetW, targetH)

  const imgW = original.naturalWidth
  const imgH = original.naturalHeight
  const hasGapLeft = crop.x < 0
  const hasGapRight = crop.x + crop.width > imgW
  const hasGapTop = crop.y < 0
  const hasGapBottom = crop.y + crop.height > imgH

  const srcLeft = Math.max(0, crop.x)
  const srcTop = Math.max(0, crop.y)
  const srcRight = Math.min(imgW, crop.x + crop.width)
  const srcBottom = Math.min(imgH, crop.y + crop.height)

  const seamXs: number[] = []

  if (srcRight > srcLeft && srcBottom > srcTop) {
    const destX = srcLeft - crop.x
    const destY = srcTop - crop.y
    const sliceW = srcRight - srcLeft
    const sliceH = srcBottom - srcTop

    if (hasGapLeft) seamXs.push(destX)
    if (hasGapRight) seamXs.push(destX + sliceW)

    drawOriginalSliceWithFeather(ctx, original, srcLeft, srcTop, sliceW, sliceH, destX, destY, {
      left: hasGapLeft ? Math.min(featherPx, Math.max(8, destX)) : 0,
      right: hasGapRight ? Math.min(featherPx, Math.max(8, targetW - (destX + sliceW))) : 0,
      top: hasGapTop ? Math.min(featherPx, Math.max(8, destY)) : 0,
      bottom: hasGapBottom ? Math.min(featherPx, Math.max(8, targetH - (destY + sliceH))) : 0,
    })
  }

  if (seamXs.length && seamHealPx > 0) {
    healVerticalSeams(ctx, seamXs, seamHealPx)
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  })
  return URL.createObjectURL(blob)
}
