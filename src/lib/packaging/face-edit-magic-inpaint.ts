import { cloneCanvas } from '@/lib/packaging/face-edit-eraser'

const MAX_PATCH_PX = 1280
const MIN_PATCH_PAD = 56
const PATCH_PAD_RATIO = 0.22

type MaskBounds = { x: number; y: number; width: number; height: number }

function findMaskBounds(mask: HTMLCanvasElement): MaskBounds | null {
  const ctx = mask.getContext('2d')
  if (!ctx) return null
  const { data, width, height } = ctx.getImageData(0, 0, mask.width, mask.height)
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const lum = Math.max(data[i]!, data[i + 1]!, data[i + 2]!)
      if (lum > 32) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
  }
  if (maxX < minX || maxY < minY) return null
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

function expandBounds(bounds: MaskBounds, imgW: number, imgH: number): MaskBounds {
  const padX = Math.max(MIN_PATCH_PAD, Math.round(bounds.width * PATCH_PAD_RATIO))
  const padY = Math.max(MIN_PATCH_PAD, Math.round(bounds.height * PATCH_PAD_RATIO))
  const x = Math.max(0, bounds.x - padX)
  const y = Math.max(0, bounds.y - padY)
  const right = Math.min(imgW, bounds.x + bounds.width + padX)
  const bottom = Math.min(imgH, bounds.y + bounds.height + padY)
  return { x, y, width: right - x, height: bottom - y }
}

function extractRegionCanvas(source: HTMLCanvasElement, region: MaskBounds): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = region.width
  canvas.height = region.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.drawImage(
    source,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    region.width,
    region.height
  )
  return canvas
}

function downscaleCanvas(source: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, width, height)
  return canvas
}

function buildFillMask(maskCtx: CanvasRenderingContext2D, w: number, h: number): Uint8Array {
  const maskData = maskCtx.getImageData(0, 0, w, h)
  const toFill = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const lum = Math.max(maskData.data[i * 4]!, maskData.data[i * 4 + 1]!, maskData.data[i * 4 + 2]!)
    toFill[i] = lum > 32 ? 1 : 0
  }
  return toFill
}

function diffusionInpaintPatch(
  source: HTMLCanvasElement,
  mask: HTMLCanvasElement,
  radiusPx: number
): HTMLCanvasElement {
  const w = source.width
  const h = source.height
  const srcCtx = source.getContext('2d')
  const maskCtx = mask.getContext('2d')
  if (!srcCtx || !maskCtx) return cloneCanvas(source)

  const src = srcCtx.getImageData(0, 0, w, h)
  const pixels = new Uint8ClampedArray(src.data)
  const toFill = buildFillMask(maskCtx, w, h)
  const wasFilled = new Uint8Array(w * h)

  let remaining = 0
  for (let i = 0; i < toFill.length; i++) if (toFill[i]) remaining++

  const maxIter = Math.max(48, Math.min(512, Math.round(radiusPx * 14) + remaining / 8))
  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ] as const

  for (let iter = 0; iter < maxIter && remaining > 0; iter++) {
    const next = new Uint8ClampedArray(pixels)
    const peeled = new Uint8Array(w * h)
    let filledThisPass = 0

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x
        if (!toFill[idx]) continue

        let r = 0
        let g = 0
        let b = 0
        let a = 0
        let n = 0
        for (const [dx, dy] of neighbors) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const ni = ny * w + nx
          if (toFill[ni]) continue
          const p = ni * 4
          r += pixels[p]!
          g += pixels[p + 1]!
          b += pixels[p + 2]!
          a += pixels[p + 3]!
          n++
        }
        if (n === 0) continue

        const p = idx * 4
        next[p] = Math.round(r / n)
        next[p + 1] = Math.round(g / n)
        next[p + 2] = Math.round(b / n)
        next[p + 3] = Math.round(a / n)
        peeled[idx] = 1
        wasFilled[idx] = 1
        filledThisPass++
      }
    }

    if (filledThisPass === 0) break

    pixels.set(next)
    for (let i = 0; i < toFill.length; i++) {
      if (peeled[i] && toFill[i]) {
        toFill[i] = 0
        remaining--
      }
    }
  }

  const smoothPasses = Math.max(1, Math.min(4, Math.round(radiusPx / 6)))
  for (let pass = 0; pass < smoothPasses; pass++) {
    const blurred = new Uint8ClampedArray(pixels)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x
        if (!wasFilled[idx]) continue
        let r = 0
        let g = 0
        let b = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const p = ((y + dy) * w + (x + dx)) * 4
            r += pixels[p]!
            g += pixels[p + 1]!
            b += pixels[p + 2]!
          }
        }
        const p = idx * 4
        blurred[p] = Math.round(r / 9)
        blurred[p + 1] = Math.round(g / 9)
        blurred[p + 2] = Math.round(b / 9)
      }
    }
    pixels.set(blurred)
  }

  const out = cloneCanvas(source)
  out.getContext('2d')?.putImageData(new ImageData(pixels, w, h), 0, 0)
  return out
}

export function magicInpaintCanvas(
  source: HTMLCanvasElement,
  mask: HTMLCanvasElement,
  radiusPx: number
): HTMLCanvasElement {
  const bounds = findMaskBounds(mask)
  if (!bounds) return cloneCanvas(source)

  const region = expandBounds(bounds, source.width, source.height)
  const maxSide = Math.max(region.width, region.height)
  const scale = maxSide > MAX_PATCH_PX ? MAX_PATCH_PX / maxSide : 1

  const patchSrc = extractRegionCanvas(source, region)
  const patchMask = extractRegionCanvas(mask, region)

  let workSrc = patchSrc
  let workMask = patchMask
  if (scale < 1) {
    const tw = Math.max(1, Math.round(region.width * scale))
    const th = Math.max(1, Math.round(region.height * scale))
    workSrc = downscaleCanvas(patchSrc, tw, th)
    workMask = downscaleCanvas(patchMask, tw, th)
  }

  const inpainted = diffusionInpaintPatch(workSrc, workMask, radiusPx * scale)
  const patchResult =
    scale < 1 ? downscaleCanvas(inpainted, region.width, region.height) : inpainted

  const output = cloneCanvas(source)
  output.getContext('2d')?.drawImage(patchResult, region.x, region.y)
  return output
}

export function preloadMagicInpaintLibrary(): void {
  /* no-op */
}
