import sharp from 'sharp'
import type { ImageLocOcrBlock } from './image-localization-types'
import { hasChineseText } from './image-localization-classifier'
import { imageLocJpegQuality } from './image-localization-config'

/** Port of 188 `image_splitter.py` defaults. */
export const IMAGE_LOC_SPLIT_MAX_HEIGHT = 1100
export const IMAGE_LOC_SPLIT_MIN_CHINESE_BLOCKS = 5
export const IMAGE_LOC_SPLIT_3_PARTS_THRESHOLD = 2400
export const IMAGE_LOC_SPLIT_SAFE_MARGIN = 25
export const IMAGE_LOC_SPLIT_MIN_GAP = 50
const SPLIT_SEARCH_RANGE = 400

export function shouldSplitTallImage(height: number, blocks: ImageLocOcrBlock[]): boolean {
  if (height <= IMAGE_LOC_SPLIT_MAX_HEIGHT) return false
  const chinese = blocks.filter((b) => hasChineseText(b.text || '')).length
  return chinese >= IMAGE_LOC_SPLIT_MIN_CHINESE_BLOCKS
}

export function findSafeSplitYs(height: number, blocks: ImageLocOcrBlock[]): number[] {
  if (height <= 0) return []
  const occupied = new Uint8Array(height)
  for (const b of blocks) {
    const bbox = b.bbox
    if (!bbox || bbox.length < 4) continue
    const y1 = Math.max(0, Math.floor(bbox[1]) - IMAGE_LOC_SPLIT_SAFE_MARGIN)
    const y2 = Math.min(height, Math.ceil(bbox[3]) + IMAGE_LOC_SPLIT_SAFE_MARGIN)
    occupied.fill(1, y1, y2)
  }
  const numParts = height > IMAGE_LOC_SPLIT_3_PARTS_THRESHOLD ? 3 : 2
  const ideal = Math.floor(height / numParts)
  const points: number[] = []
  for (let i = 1; i < numParts; i++) {
    const targetY = i * ideal
    const startScan = Math.max(0, targetY - SPLIT_SEARCH_RANGE)
    const endScan = Math.min(height, targetY + SPLIT_SEARCH_RANGE)
    let best = -1
    let minDist = Number.POSITIVE_INFINITY
    let gapStart = -1
    for (let y = startScan; y < endScan; y++) {
      if (!occupied[y]) {
        if (gapStart < 0) gapStart = y
        continue
      }
      if (gapStart >= 0) {
        const gapSize = y - gapStart
        if (gapSize >= IMAGE_LOC_SPLIT_MIN_GAP) {
          const mid = gapStart + Math.floor(gapSize / 2)
          const dist = Math.abs(mid - targetY)
          if (dist < minDist) {
            minDist = dist
            best = mid
          }
        }
        gapStart = -1
      }
    }
    if (gapStart >= 0) {
      const gapSize = endScan - gapStart
      if (gapSize >= IMAGE_LOC_SPLIT_MIN_GAP) {
        const mid = gapStart + Math.floor(gapSize / 2)
        const dist = Math.abs(mid - targetY)
        if (dist < minDist) best = mid
      }
    }
    points.push(best >= 0 ? best : targetY)
  }
  return points.filter((y) => y > 0 && y < height)
}

export function splitYRanges(height: number, splitYs: number[]): Array<{ y0: number; y1: number }> {
  const bounds = [0, ...[...splitYs].sort((a, b) => a - b).filter((y) => y > 0 && y < height), height]
  const ranges: Array<{ y0: number; y1: number }> = []
  for (let i = 0; i < bounds.length - 1; i++) {
    if (bounds[i + 1] > bounds[i]) ranges.push({ y0: bounds[i], y1: bounds[i + 1] })
  }
  return ranges.length ? ranges : [{ y0: 0, y1: height }]
}

export function adjustOcrBlocksForPart(
  blocks: ImageLocOcrBlock[],
  y0: number,
  y1: number
): ImageLocOcrBlock[] {
  const out: ImageLocOcrBlock[] = []
  for (const b of blocks) {
    const bbox = b.bbox
    if (!bbox || bbox.length < 4) continue
    const cy = (bbox[1] + bbox[3]) / 2
    if (cy < y0 || cy >= y1) continue
    const ny1 = Math.max(0, bbox[1] - y0)
    const ny2 = Math.min(bbox[3] - y0, y1 - y0)
    if (ny2 > ny1) out.push({ text: b.text, bbox: [bbox[0], ny1, bbox[2], ny2] })
  }
  return out
}

export async function cropImagePart(bytes: Buffer, y0: number, y1: number): Promise<Buffer> {
  const meta = await sharp(bytes).metadata()
  const width = meta.width || 0
  const height = meta.height || 0
  if (!width || !height) return bytes
  const top = Math.max(0, Math.min(height - 1, Math.floor(y0)))
  const h = Math.max(1, Math.min(height - top, Math.ceil(y1) - top))
  return sharp(bytes).extract({ left: 0, top, width, height: h }).toBuffer()
}

export async function vstackImageParts(parts: Buffer[]): Promise<Buffer> {
  if (!parts.length) throw new Error('Không có phần ảnh để ghép')
  if (parts.length === 1) return parts[0]
  const metas = await Promise.all(parts.map((p) => sharp(p).metadata()))
  const width = Math.max(1, ...metas.map((m) => m.width || 0))
  const composites: Array<{ input: Buffer; top: number; left: number }> = []
  let y = 0
  for (let i = 0; i < parts.length; i++) {
    const srcW = metas[i].width || width
    const srcH = Math.max(1, metas[i].height || 1)
    const input =
      srcW === width
        ? parts[i]
        : await sharp(parts[i])
            .resize({
              width,
              height: srcH,
              fit: 'contain',
              background: { r: 255, g: 255, b: 255 },
            })
            .toBuffer()
    composites.push({ input, top: y, left: 0 })
    y += srcH
  }
  return sharp({
    create: { width, height: y, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite(composites)
    .jpeg({ quality: imageLocJpegQuality(), mozjpeg: true })
    .toBuffer()
}

export type TallImagePart = {
  bytes: Buffer
  blocks: ImageLocOcrBlock[]
  y0: number
  y1: number
  filename: string
}

export async function splitTallImageIfNeeded(opts: {
  bytes: Buffer
  blocks: ImageLocOcrBlock[]
  filename: string
}): Promise<TallImagePart[]> {
  const meta = await sharp(opts.bytes).metadata()
  const height = meta.height || 0
  if (!shouldSplitTallImage(height, opts.blocks)) {
    return [{ bytes: opts.bytes, blocks: opts.blocks, y0: 0, y1: height, filename: opts.filename }]
  }
  const ys = findSafeSplitYs(height, opts.blocks)
  const ranges = splitYRanges(height, ys)
  if (ranges.length <= 1) {
    return [{ bytes: opts.bytes, blocks: opts.blocks, y0: 0, y1: height, filename: opts.filename }]
  }
  const base = opts.filename.replace(/\.[^.]+$/, '') || 'image'
  const ext = (opts.filename.match(/\.[^.]+$/) || ['.jpg'])[0]
  const parts: TallImagePart[] = []
  for (let i = 0; i < ranges.length; i++) {
    const { y0, y1 } = ranges[i]
    parts.push({
      bytes: await cropImagePart(opts.bytes, y0, y1),
      blocks: adjustOcrBlocksForPart(opts.blocks, y0, y1),
      y0,
      y1,
      filename: `${base}_part${i + 1}_of_${ranges.length}${ext}`,
    })
  }
  return parts
}
