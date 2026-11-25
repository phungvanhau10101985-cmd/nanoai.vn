import sharp from 'sharp'
import {
  IMAGE_LOC_OCR_MAX_IMAGE_WIDTH,
  estimateImageLocMergedPixels,
  mapImageLocOcrBlocksToSource,
  mergeImageLocOcrBatch,
  planImageLocOcrBatches,
  type ImageLocOcrBatchSource,
} from '@/lib/messaging/image-localization/batch-ocr'
import { ocrImageBlocks } from '@/lib/messaging/image-localization/local-pipeline'

/** Dưới ngưỡng Vision đang dùng cho một request OCR. */
const SLIDE_OCR_MAX_PIXELS = 15_000_000

export type SlideOcrLine = {
  text: string
  x: number
  y: number
  w: number
  h: number
}

export type SlideOcrResult = {
  id: string
  width: number
  height: number
  lines: SlideOcrLine[]
}

function mergeShape(width: number, height: number, extraScale = 1) {
  const widthScale = width > IMAGE_LOC_OCR_MAX_IMAGE_WIDTH ? IMAGE_LOC_OCR_MAX_IMAGE_WIDTH / width : 1
  const scaleFactor = widthScale * extraScale
  return {
    mergeWidth: Math.max(1, Math.trunc(width * scaleFactor)),
    mergeHeight: Math.max(1, Math.trunc(height * scaleFactor)),
    scaleFactor,
  }
}

function fitSources(sources: ImageLocOcrBatchSource[]): ImageLocOcrBatchSource[] {
  let extra = 1
  let fitted = sources.map((source) => ({ ...source, ...mergeShape(source.width, source.height, extra) }))
  while (estimateImageLocMergedPixels(fitted) > SLIDE_OCR_MAX_PIXELS && extra > 0.35) {
    extra *= 0.85
    fitted = sources.map((source) => ({ ...source, ...mergeShape(source.width, source.height, extra) }))
  }
  return fitted
}

function toLines(blocks: { text: string; bbox: [number, number, number, number] }[]): SlideOcrLine[] {
  return blocks
    .map((block) => {
      const [x1, y1, x2, y2] = block.bbox
      return {
        text: block.text.replace(/\s+/g, ' ').trim(),
        x: x1,
        y: y1,
        w: Math.max(1, x2 - x1),
        h: Math.max(1, y2 - y1),
      }
    })
    .filter((line) => line.text.length > 0)
    .sort((a, b) => a.y - b.y || a.x - b.x)
}

/**
 * Ghép các ảnh slide, gọi Vision một lần cho mỗi lô, trả tọa độ chữ theo pixel của từng ảnh gốc.
 */
export async function ocrSlideImagesInBatches(
  slides: Array<{ id: string; bytes: Buffer }>,
  userId?: string | null
): Promise<SlideOcrResult[]> {
  const sources: ImageLocOcrBatchSource[] = []
  for (const slide of slides) {
    const metadata = await sharp(slide.bytes, { limitInputPixels: false, sequentialRead: true }).metadata()
    const width = metadata.width || 0
    const height = metadata.height || 0
    if (width <= 0 || height <= 0) continue
    sources.push({
      url: slide.id,
      bytes: slide.bytes,
      filename: slide.id,
      width,
      height,
      ...mergeShape(width, height),
    })
  }
  const results: SlideOcrResult[] = []
  for (const batch of planImageLocOcrBatches(fitSources(sources))) {
    const merged = await mergeImageLocOcrBatch(batch)
    const { blocks } = await ocrImageBlocks(merged.bytes, userId ?? null, { preserveResolution: true })
    for (const source of batch) {
      const position = merged.positions.get(source.url)
      const mapped = position ? mapImageLocOcrBlocksToSource(blocks, position) : []
      results.push({
        id: source.url,
        width: source.width,
        height: source.height,
        lines: toLines(mapped),
      })
    }
  }
  return results
}
