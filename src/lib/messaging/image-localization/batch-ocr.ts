import sharp from 'sharp'
import type { ImageLocOcrBlock, ImageProcessResult } from './image-localization-types'
import { isOwnCdnUrl, normalizeImageUrl } from './image-localization-config'
import { ImageLocalizationError } from './gemini-adapter'
import { ocrImageBlocks } from './local-pipeline'
import { downloadLocalizationImage } from './process-one'

const LARGE_IMAGE_INPUT = { limitInputPixels: false, sequentialRead: true } as const

/** Đồng bộ config ImageMerger của 188-com-vn. */
export const IMAGE_LOC_OCR_BATCH_SIZE = 10
export const IMAGE_LOC_OCR_MERGE_MAX_PIXELS = 70_000_000
export const IMAGE_LOC_OCR_MIN_IMAGE_WIDTH = 500
export const IMAGE_LOC_OCR_MAX_IMAGE_WIDTH = 5_000
export const IMAGE_LOC_OCR_MERGE_SPACING = 10

export type ImageLocOcrBatchSource = {
  url: string
  bytes: Buffer
  filename: string
  width: number
  height: number
  mergeWidth: number
  mergeHeight: number
  scaleFactor: number
}

export type ImageLocOcrBatchPosition = {
  x: number
  y: number
  width: number
  height: number
  scaleFactor: number
}

export type ImageLocPreparedOcr = {
  url: string
  bytes: Buffer
  filename: string
  blocks: ImageLocOcrBlock[]
}

function mergeShape(width: number, height: number) {
  const scaleFactor =
    width > IMAGE_LOC_OCR_MAX_IMAGE_WIDTH ? IMAGE_LOC_OCR_MAX_IMAGE_WIDTH / width : 1
  return {
    mergeWidth: Math.max(1, Math.trunc(width * scaleFactor)),
    mergeHeight: Math.max(1, Math.trunc(height * scaleFactor)),
    scaleFactor,
  }
}

export function estimateImageLocMergedPixels(images: ImageLocOcrBatchSource[]): number {
  if (!images.length) return 0
  const maxWidth = Math.max(...images.map((image) => image.mergeWidth))
  const totalHeight =
    images.reduce((sum, image) => sum + image.mergeHeight, 0) +
    Math.max(0, images.length - 1) * IMAGE_LOC_OCR_MERGE_SPACING
  return maxWidth * totalHeight
}

export function planImageLocOcrBatches(
  images: ImageLocOcrBatchSource[]
): ImageLocOcrBatchSource[][] {
  const batches: ImageLocOcrBatchSource[][] = []
  let current: ImageLocOcrBatchSource[] = []
  for (const image of images) {
    if (!current.length) {
      current = [image]
      continue
    }
    const trial = [...current, image]
    if (
      trial.length > IMAGE_LOC_OCR_BATCH_SIZE ||
      estimateImageLocMergedPixels(trial) > IMAGE_LOC_OCR_MERGE_MAX_PIXELS
    ) {
      batches.push(current)
      current = [image]
    } else {
      current = trial
    }
  }
  if (current.length) batches.push(current)
  return batches
}

export function mapImageLocOcrBlocksToSource(
  batchBlocks: ImageLocOcrBlock[],
  position: ImageLocOcrBatchPosition
): ImageLocOcrBlock[] {
  const { x: bx, y: by, width: bw, height: bh } = position
  const scale = position.scaleFactor > 0 ? position.scaleFactor : 1
  const mapped: ImageLocOcrBlock[] = []
  for (const item of batchBlocks) {
    const [x1, y1, x2, y2] = item.bbox.map((value) => Math.trunc(Number(value))) as [
      number,
      number,
      number,
      number,
    ]
    // Giống ImageSplitter 188: chỉ bỏ box hoàn toàn nằm ngoài ảnh con.
    if (x2 < bx || x1 > bx + bw || y2 < by || y1 > by + bh) continue
    const origX1 = Math.trunc(Math.max(0, x1 - bx) / scale)
    const origY1 = Math.trunc(Math.max(0, y1 - by) / scale)
    const origX2 = Math.trunc(Math.min(bw, x2 - bx) / scale)
    const origY2 = Math.trunc(Math.min(bh, y2 - by) / scale)
    if (origX2 > origX1 && origY2 > origY1) {
      mapped.push({ text: item.text, bbox: [origX1, origY1, origX2, origY2] })
    }
  }
  return mapped
}

export async function mergeImageLocOcrBatch(images: ImageLocOcrBatchSource[]): Promise<{
  bytes: Buffer
  positions: Map<string, ImageLocOcrBatchPosition>
}> {
  if (!images.length) throw new Error('Image localization OCR batch is empty')
  const canvasWidth = Math.max(...images.map((image) => image.mergeWidth))
  const canvasHeight =
    images.reduce((sum, image) => sum + image.mergeHeight, 0) +
    Math.max(0, images.length - 1) * IMAGE_LOC_OCR_MERGE_SPACING
  const composites: Array<{ input: Buffer; left: number; top: number }> = []
  const positions = new Map<string, ImageLocOcrBatchPosition>()
  let y = 0

  for (const image of images) {
    const x = Math.trunc((canvasWidth - image.mergeWidth) / 2)
    const input = await sharp(image.bytes, LARGE_IMAGE_INPUT)
      .resize({ width: image.mergeWidth, height: image.mergeHeight, fit: 'fill' })
      .png()
      .toBuffer()
    composites.push({ input, left: x, top: y })
    positions.set(image.url, {
      x,
      y,
      width: image.mergeWidth,
      height: image.mergeHeight,
      scaleFactor: image.scaleFactor,
    })
    y += image.mergeHeight + IMAGE_LOC_OCR_MERGE_SPACING
  }

  const bytes = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: '#ffffff',
    },
  })
    .composite(composites)
    .jpeg({ quality: 95, mozjpeg: true })
    .toBuffer()
  return { bytes, positions }
}

export async function prepareImageLocBatchOcr(opts: {
  urls: string[]
  force: boolean
  userId?: string | null
  shouldCancel?: () => boolean
  progressCb?: (phase: string) => void
}): Promise<{
  prepared: Map<string, ImageLocPreparedOcr>
  earlyResults: Map<string, ImageProcessResult>
}> {
  const prepared = new Map<string, ImageLocPreparedOcr>()
  const earlyResults = new Map<string, ImageProcessResult>()
  const downloaded: ImageLocOcrBatchSource[] = []

  for (const rawUrl of opts.urls) {
    if (opts.shouldCancel?.()) throw new ImageLocalizationError('Job đã bị hủy')
    const url = normalizeImageUrl(rawUrl)
    if (!opts.force && isOwnCdnUrl(url)) {
      earlyResults.set(url, {
        original_url: url,
        final_url: url,
        status: 'kept',
        message: 'Ảnh đã ở CDN shop',
      })
      continue
    }
    try {
      const { bytes, filename } = await downloadLocalizationImage(url)
      const metadata = await sharp(bytes, LARGE_IMAGE_INPUT).metadata()
      const width = metadata.width || 0
      const height = metadata.height || 0
      if (width < IMAGE_LOC_OCR_MIN_IMAGE_WIDTH || height <= 0) {
        earlyResults.set(url, {
          original_url: url,
          final_url: null,
          status: 'deleted',
          message: `Ảnh quá nhỏ (${width}x${height}), nhỏ hơn ${IMAGE_LOC_OCR_MIN_IMAGE_WIDTH}px`,
        })
        continue
      }
      downloaded.push({ url, bytes, filename, width, height, ...mergeShape(width, height) })
    } catch (error) {
      earlyResults.set(url, {
        original_url: url,
        final_url: null,
        status: 'deleted',
        message: `Không tải/đọc được ảnh: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  const batches = planImageLocOcrBatches(downloaded)
  const prepareSingle = async (source: ImageLocOcrBatchSource) => {
    const { blocks } = await ocrImageBlocks(source.bytes, opts.userId)
    prepared.set(source.url, {
      url: source.url,
      bytes: source.bytes,
      filename: source.filename,
      blocks,
    })
  }
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]
    if (opts.shouldCancel?.()) throw new ImageLocalizationError('Job đã bị hủy')
    let merged: Awaited<ReturnType<typeof mergeImageLocOcrBatch>>
    try {
      merged = await mergeImageLocOcrBatch(batch)
    } catch (error) {
      // 188 bỏ batch ghép lỗi rồi tiếp tục các batch khác; URL sẽ được giữ nguyên.
      console.error(
        `[image-localization] không ghép được OCR batch ${batchIndex + 1}/${batches.length}`,
        error
      )
      opts.progressCb?.(`OCR riêng ${batch.length} ảnh do lỗi ghép lô`)
      for (const source of batch) await prepareSingle(source)
      continue
    }
    opts.progressCb?.(`OCR lô ${batchIndex + 1}/${batches.length}`)
    const { blocks } = await ocrImageBlocks(merged.bytes, opts.userId, {
      preserveResolution: true,
    })
    for (const source of batch) {
      const position = merged.positions.get(source.url)
      if (!position) continue
      prepared.set(source.url, {
        url: source.url,
        bytes: source.bytes,
        filename: source.filename,
        blocks: mapImageLocOcrBlocksToSource(blocks, position),
      })
    }
    for (const source of batch) {
      if (!prepared.has(source.url)) await prepareSingle(source)
    }
  }

  return { prepared, earlyResults }
}
