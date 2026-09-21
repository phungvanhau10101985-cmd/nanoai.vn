import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import {
  IMAGE_LOC_OCR_MAX_IMAGE_WIDTH,
  IMAGE_LOC_OCR_MERGE_SPACING,
  estimateImageLocMergedPixels,
  mapImageLocOcrBlocksToSource,
  mergeImageLocOcrBatch,
  planImageLocOcrBatches,
  type ImageLocOcrBatchSource,
} from './batch-ocr'

function source(index: number, width = 1_000, height = 1_000): ImageLocOcrBatchSource {
  const scaleFactor = width > IMAGE_LOC_OCR_MAX_IMAGE_WIDTH ? IMAGE_LOC_OCR_MAX_IMAGE_WIDTH / width : 1
  return {
    url: `https://example.com/${index}.jpg`,
    bytes: Buffer.from('not-used-by-planner'),
    filename: `${index}.jpg`,
    width,
    height,
    mergeWidth: Math.trunc(width * scaleFactor),
    mergeHeight: Math.trunc(height * scaleFactor),
    scaleFactor,
  }
}

describe('batch OCR parity with 188 ImageMerger', () => {
  it('limits a batch to 10 images', () => {
    const batches = planImageLocOcrBatches(Array.from({ length: 11 }, (_, index) => source(index)))
    assert.deepEqual(batches.map((batch) => batch.length), [10, 1])
  })

  it('starts a new batch before the merged canvas exceeds 70MP', () => {
    const images = [source(0, 5_000, 7_000), source(1, 5_000, 7_000), source(2, 5_000, 7_000)]
    assert.deepEqual(planImageLocOcrBatches(images).map((batch) => batch.length), [1, 1, 1])
    assert.equal(
      estimateImageLocMergedPixels(images.slice(0, 2)),
      5_000 * (7_000 * 2 + IMAGE_LOC_OCR_MERGE_SPACING)
    )
  })

  it('maps merged OCR coordinates back through offset and resize scale', () => {
    const mapped = mapImageLocOcrBlocksToSource(
      [
        { text: '中文', bbox: [120, 240, 320, 340] },
        { text: 'outside', bbox: [0, 0, 10, 10] },
      ],
      { x: 100, y: 200, width: 500, height: 400, scaleFactor: 0.5 }
    )
    assert.deepEqual(mapped, [{ text: '中文', bbox: [40, 80, 440, 280] }])
  })

  it('centers images on a white vertical canvas with 10px spacing', async () => {
    const firstBytes = await sharp({
      create: { width: 40, height: 20, channels: 3, background: '#ff0000' },
    })
      .jpeg()
      .toBuffer()
    const secondBytes = await sharp({
      create: { width: 20, height: 30, channels: 3, background: '#0000ff' },
    })
      .jpeg()
      .toBuffer()
    const first = { ...source(0, 40, 20), bytes: firstBytes }
    const second = { ...source(1, 20, 30), bytes: secondBytes }
    const merged = await mergeImageLocOcrBatch([first, second])
    const metadata = await sharp(merged.bytes).metadata()
    assert.equal(metadata.width, 40)
    assert.equal(metadata.height, 20 + IMAGE_LOC_OCR_MERGE_SPACING + 30)
    assert.deepEqual(merged.positions.get(first.url), {
      x: 0,
      y: 0,
      width: 40,
      height: 20,
      scaleFactor: 1,
    })
    assert.deepEqual(merged.positions.get(second.url), {
      x: 10,
      y: 30,
      width: 20,
      height: 30,
      scaleFactor: 1,
    })
  })
})
