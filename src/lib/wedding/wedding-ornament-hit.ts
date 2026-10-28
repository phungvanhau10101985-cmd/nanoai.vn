/** Ngưỡng alpha: điểm trong suốt không được nuốt cú chọn của mảnh hoa phía sau. */
export const ORNAMENT_ALPHA_HIT = 28
/** Bán kính màn hình để vẫn chạm được cành và cánh nhỏ. */
export const ORNAMENT_HIT_SLOP = 12

export type OrnamentPlane = {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

/** Đổi điểm màn hình sang tỷ lệ 0–1 trong ảnh, đã tính xoay, lật và zoom của khung. */
export function ornamentLocalRatio(input: {
  clientX: number
  clientY: number
  originX: number
  originY: number
  scaleX: number
  scaleY: number
  width: number
  height: number
  plane: OrnamentPlane
}): { u: number; v: number } | null {
  const { width, height, scaleX, scaleY, plane } = input
  if (width < 1 || height < 1 || scaleX === 0 || scaleY === 0) return null
  const det = plane.a * plane.d - plane.b * plane.c
  if (!Number.isFinite(det) || Math.abs(det) < 1e-6) return null
  const dx = (input.clientX - input.originX) / scaleX - plane.e
  const dy = (input.clientY - input.originY) / scaleY - plane.f
  const lx = (plane.d * dx - plane.c * dy) / det
  const ly = (-plane.b * dx + plane.a * dy) / det
  const u = (lx + width / 2) / width
  const v = (ly + height / 2) / height
  if (u < -0.04 || v < -0.04 || u > 1.04 || v > 1.04) return null
  return { u, v }
}

export function pickTopOrnament(hits: Array<{ index: number; exact: boolean; near: boolean }>): number | null {
  const exact = hits.find((hit) => hit.exact)
  if (exact) return exact.index
  const near = hits.find((hit) => hit.near)
  return near ? near.index : null
}

const pixelCache = new Map<string, { pixels: Uint8ClampedArray; w: number; h: number } | 'solid'>()

export function rememberOrnamentPixels(img: HTMLImageElement) {
  const src = img.currentSrc || img.src
  if (!src || pixelCache.has(src)) return
  const naturalW = img.naturalWidth
  const naturalH = img.naturalHeight
  if (!naturalW || !naturalH) return
  const max = 160
  const scale = Math.min(1, max / Math.max(naturalW, naturalH))
  const w = Math.max(1, Math.round(naturalW * scale))
  const h = Math.max(1, Math.round(naturalH * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  try {
    ctx.drawImage(img, 0, 0, w, h)
    pixelCache.set(src, { pixels: ctx.getImageData(0, 0, w, h).data, w, h })
  } catch {
    pixelCache.set(src, 'solid')
  }
}

function alphaAt(src: string, u: number, v: number): number | null {
  const entry = pixelCache.get(src)
  if (!entry) return null
  if (entry === 'solid') return 255
  if (u < 0 || v < 0 || u > 1 || v > 1) return 0
  const x = Math.min(entry.w - 1, Math.max(0, Math.floor(u * entry.w)))
  const y = Math.min(entry.h - 1, Math.max(0, Math.floor(v * entry.h)))
  return entry.pixels[(y * entry.w + x) * 4 + 3] ?? 0
}

function planeOf(transform: string): OrnamentPlane {
  if (!transform || transform === 'none') return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  const matrix = new DOMMatrix(transform)
  return { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, e: matrix.e, f: matrix.f }
}

function ratioOnImage(img: HTMLImageElement, clientX: number, clientY: number) {
  const host = img.parentElement
  if (!host) return null
  const hostRect = host.getBoundingClientRect()
  const hostW = host.offsetWidth
  const hostH = host.offsetHeight
  if (hostW < 1 || hostH < 1) return null
  const style = getComputedStyle(img)
  return ornamentLocalRatio({
    clientX,
    clientY,
    originX: hostRect.left + hostRect.width / 2,
    originY: hostRect.top + hostRect.height / 2,
    scaleX: hostRect.width / hostW,
    scaleY: hostRect.height / hostH,
    width: img.offsetWidth || hostW,
    height: img.offsetHeight || hostH,
    plane: planeOf(style.transform),
  })
}

const SLOP_RING = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7, 0.7],
  [0.7, -0.7],
  [-0.7, 0.7],
  [-0.7, -0.7],
] as const

function imageOpaque(img: HTMLImageElement, clientX: number, clientY: number, slop: number) {
  if (img.complete) rememberOrnamentPixels(img)
  const src = img.currentSrc || img.src
  const exactRatio = ratioOnImage(img, clientX, clientY)
  const exactAlpha = exactRatio ? alphaAt(src, exactRatio.u, exactRatio.v) : 0
  if (exactAlpha == null) {
    const host = img.parentElement?.getBoundingClientRect()
    const inside = Boolean(host && clientX >= host.left && clientX <= host.right && clientY >= host.top && clientY <= host.bottom)
    return { exact: inside, near: inside }
  }
  if (exactAlpha >= ORNAMENT_ALPHA_HIT) return { exact: true, near: true }
  for (const [sx, sy] of SLOP_RING) {
    const ratio = ratioOnImage(img, clientX + sx * slop, clientY + sy * slop)
    if (!ratio) continue
    const alpha = alphaAt(src, ratio.u, ratio.v)
    if (alpha != null && alpha >= ORNAMENT_ALPHA_HIT) return { exact: false, near: true }
  }
  return { exact: false, near: false }
}

/** Mảnh vẽ trên cùng tại điểm bấm. Ảnh trong suốt không chặn mảnh phía sau. */
export function pickOrnamentHit(layer: HTMLElement, clientX: number, clientY: number): number | null {
  const images = [...layer.querySelectorAll<HTMLImageElement>('img[data-ornament-index]')]
  images.sort((a, b) => {
    const za = Number(a.parentElement?.style.zIndex || 0)
    const zb = Number(b.parentElement?.style.zIndex || 0)
    if (za !== zb) return zb - za
    return Number(b.dataset.ornamentIndex) - Number(a.dataset.ornamentIndex)
  })
  const hits: Array<{ index: number; exact: boolean; near: boolean }> = []
  for (const img of images) {
    const index = Number(img.dataset.ornamentIndex)
    if (!Number.isInteger(index)) continue
    const hit = imageOpaque(img, clientX, clientY, ORNAMENT_HIT_SLOP)
    if (hit.exact || hit.near) hits.push({ index, ...hit })
  }
  return pickTopOrnament(hits)
}
