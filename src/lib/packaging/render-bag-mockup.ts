import { createCanvas, loadImage, type CanvasRenderingContext2D, type Image } from 'canvas'
import type { BagDimensionsMm } from '@/lib/packaging/bag-dimensions'
import { resolveBagFacePreviewUrl, type BagFaceSlot } from '@/lib/hub-chat/bag-kit-shared'

const KRAFT = '#c9b08a'

type Point = { x: number; y: number }

/** x=panel width W, y=gusset depth G, z=bag height H (same iso axes as box mockup). */
function iso(x: number, y: number, z: number, s: number): Point {
  return {
    x: (x + y) * 0.866 * s,
    y: (x - y) * 0.5 * s - z * s,
  }
}

function drawParallelogramImage(
  ctx: CanvasRenderingContext2D,
  img: Image,
  p0: Point,
  p1: Point,
  p3: Point
): void {
  const w = img.width
  const h = img.height
  const deltaX1 = p1.x - p0.x
  const deltaY1 = p1.y - p0.y
  const deltaX2 = p3.x - p0.x
  const deltaY2 = p3.y - p0.y
  ctx.save()
  ctx.transform(deltaX1 / w, deltaY1 / w, deltaX2 / h, deltaY2 / h, p0.x, p0.y)
  ctx.drawImage(img, 0, 0, w, h)
  ctx.restore()
}

function fillParallelogram(
  ctx: CanvasRenderingContext2D,
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  fill: string
): void {
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(p0.x, p0.y)
  ctx.lineTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.lineTo(p3.x, p3.y)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.restore()
}

function drawFaceQuad(
  ctx: CanvasRenderingContext2D,
  img: Image | null,
  quad: [Point, Point, Point, Point]
): void {
  const [p0, p1, p2, p3] = quad
  if (img) {
    drawParallelogramImage(ctx, img, p0, p1, p3)
  } else {
    fillParallelogram(ctx, p0, p1, p2, p3, KRAFT)
  }
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(p0.x, p0.y)
  ctx.lineTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.lineTo(p3.x, p3.y)
  ctx.closePath()
  ctx.strokeStyle = 'rgba(0,0,0,0.06)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

async function loadOptionalImage(url: string | null | undefined): Promise<Image | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await loadImage(Buffer.from(await res.arrayBuffer()))
  } catch {
    return null
  }
}

/** Deterministic isometric bag mockup — front/back art on panels, kraft gussets. */
export async function renderBagMockupPng(input: {
  faceSlots: Partial<
    Record<BagFaceSlot, { sourceMode: string; url?: string }>
  >
  bag: BagDimensionsMm
  outputSize?: number
}): Promise<Buffer> {
  const { faceSlots, bag, outputSize = 1200 } = input
  const W = bag.width
  const G = bag.gusset
  const H = bag.height

  const unitCorners = [
    iso(0, 0, 0, 1),
    iso(W, 0, 0, 1),
    iso(W, G, 0, 1),
    iso(0, G, 0, 1),
    iso(0, 0, H, 1),
    iso(W, 0, H, 1),
    iso(W, G, H, 1),
    iso(0, G, H, 1),
  ]
  const xs = unitCorners.map((v) => v.x)
  const ys = unitCorners.map((v) => v.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const bw = maxX - minX
  const bh = maxY - minY
  const pad = outputSize * 0.08
  const scale = Math.min((outputSize - 2 * pad) / bw, (outputSize - 2 * pad) / bh)

  const p = (x: number, y: number, z: number): Point => {
    const q = iso(x, y, z, scale)
    return {
      x: q.x - minX * scale + pad,
      y: q.y - minY * scale + pad,
    }
  }

  const bagKit = { faceSlots }
  const [frontImg, backImg] = await Promise.all([
    loadOptionalImage(resolveBagFacePreviewUrl(bagKit, 'front')),
    loadOptionalImage(resolveBagFacePreviewUrl(bagKit, 'back')),
  ])

  const canvas = createCanvas(outputSize, outputSize)
  const ctx = canvas.getContext('2d')

  const bg = ctx.createLinearGradient(0, 0, 0, outputSize)
  bg.addColorStop(0, '#eef1f5')
  bg.addColorStop(1, '#d8dde6')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, outputSize, outputSize)

  const floorY =
    Math.max(p(0, 0, 0).y, p(W, 0, 0).y, p(W, G, 0).y, p(0, G, 0).y) + pad * 0.12
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.beginPath()
  ctx.ellipse(outputSize / 2, floorY, outputSize * 0.28, outputSize * 0.05, 0, 0, Math.PI * 2)
  ctx.fill()

  const rightGussetQuad: [Point, Point, Point, Point] = [
    p(W, 0, H),
    p(W, G, H),
    p(W, G, 0),
    p(W, 0, 0),
  ]
  const frontQuad: [Point, Point, Point, Point] = [
    p(0, 0, H),
    p(W, 0, H),
    p(W, 0, 0),
    p(0, 0, 0),
  ]
  const backQuad: [Point, Point, Point, Point] = [
    p(W, G, H),
    p(0, G, H),
    p(0, G, 0),
    p(W, G, 0),
  ]

  drawFaceQuad(ctx, backImg, backQuad)
  drawFaceQuad(ctx, null, rightGussetQuad)
  drawFaceQuad(ctx, frontImg, frontQuad)

  return canvas.toBuffer('image/png')
}
