import { createCanvas, loadImage, type CanvasRenderingContext2D, type Image } from 'canvas'
import {
  resolveMockupSlotUrl,
  type BoxCreatedFace,
  type BoxFaceSlot,
} from '@/lib/packaging/box-face-slots'

const KRAFT = '#c9b08a'

type Point = { x: number; y: number }

/** Same axes as box-wireframe-svg: x=L, y=W (depth), z=H (vertical). */
function iso(x: number, y: number, z: number, s: number): Point {
  return {
    // Camera faces the semantic FRONT (y=0) and RIGHT (x=L) sides.
    // Increasing depth therefore travels up-right, not down-left behind the
    // front face. This keeps top/front/right as three adjacent exterior faces.
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

/** Deterministic 3D box mockup — each face texture on its slot only (no logo, no cross-face copy). */
export async function renderBoxMockupPng(input: {
  faces: Pick<BoxCreatedFace, 'slot' | 'url' | 'sourceMode'>[]
  faceSlots?: Partial<Record<BoxFaceSlot, { sourceMode: BoxCreatedFace['sourceMode']; url?: string }>>
  box: { length: number; width: number; height: number }
  outputSize?: number
}): Promise<Buffer> {
  const { faces, box, outputSize = 1200 } = input
  const L = box.length
  const W = box.width
  const H = box.height

  const unitCorners = [
    iso(0, 0, 0, 1),
    iso(L, 0, 0, 1),
    iso(L, W, 0, 1),
    iso(0, W, 0, 1),
    iso(0, 0, H, 1),
    iso(L, 0, H, 1),
    iso(L, W, H, 1),
    iso(0, W, H, 1),
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

  const slotImages: Partial<Record<BoxFaceSlot, Image | null>> = {}
  const slots: BoxFaceSlot[] = ['top', 'front', 'right', 'bottom', 'back', 'left']
  await Promise.all(
    slots.map(async (slot) => {
      let url: string | null = null
      if (input.faceSlots) {
        url = resolveMockupSlotUrl(slot, input.faceSlots)
      } else {
        const face = faces.find((f) => f.slot === slot)
        url = face && face.sourceMode !== 'empty' ? face.url : null
      }
      slotImages[slot] = await loadOptionalImage(url)
    })
  )

  const canvas = createCanvas(outputSize, outputSize)
  const ctx = canvas.getContext('2d')

  const bg = ctx.createLinearGradient(0, 0, 0, outputSize)
  bg.addColorStop(0, '#eef1f5')
  bg.addColorStop(1, '#d8dde6')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, outputSize, outputSize)

  const floorY =
    Math.max(p(0, 0, 0).y, p(L, 0, 0).y, p(L, W, 0).y, p(0, W, 0).y) + pad * 0.12
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.beginPath()
  ctx.ellipse(outputSize / 2, floorY, outputSize * 0.28, outputSize * 0.05, 0, 0, Math.PI * 2)
  ctx.fill()

  // Match box-wireframe-svg visible faces; image (0,0) = top-left of flat print file.
  const rightQuad: [Point, Point, Point, Point] = [p(L, 0, H), p(L, W, H), p(L, W, 0), p(L, 0, 0)]
  const topQuad: [Point, Point, Point, Point] = [p(0, 0, H), p(L, 0, H), p(L, W, H), p(0, W, H)]
  const frontQuad: [Point, Point, Point, Point] = [p(0, 0, H), p(L, 0, H), p(L, 0, 0), p(0, 0, 0)]

  drawFaceQuad(ctx, slotImages.right ?? null, rightQuad)
  drawFaceQuad(ctx, slotImages.top ?? null, topQuad)
  drawFaceQuad(ctx, slotImages.front ?? null, frontQuad)

  return canvas.toBuffer('image/png')
}
