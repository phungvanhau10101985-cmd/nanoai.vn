import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  adjustOcrBlocksForPart,
  findSafeSplitYs,
  shouldSplitTallImage,
  splitYRanges,
} from './split-tall-image'

describe('split tall image (188 parity)', () => {
  it('does not split short images even with many Hanzi blocks', () => {
    const blocks = Array.from({ length: 8 }, (_, i) => ({
      text: '中文标题',
      bbox: [0, i * 40, 80, i * 40 + 20] as [number, number, number, number],
    }))
    assert.equal(shouldSplitTallImage(900, blocks), false)
  })

  it('splits when height > 1100 and Hanzi blocks >= 5', () => {
    const blocks = Array.from({ length: 6 }, (_, i) => ({
      text: '中文',
      bbox: [0, i * 200, 40, i * 200 + 20] as [number, number, number, number],
    }))
    assert.equal(shouldSplitTallImage(1800, blocks), true)
  })

  it('does not split a tall image with few Chinese clusters', () => {
    const blocks = [
      { text: '中', bbox: [0, 10, 20, 30] as [number, number, number, number] },
      { text: 'SKU', bbox: [0, 400, 40, 420] as [number, number, number, number] },
    ]
    assert.equal(shouldSplitTallImage(2000, blocks), false)
  })

  it('cuts in a whitespace gap near the midpoint', () => {
    const height = 2000
    const blocks = [
      { text: '中文一', bbox: [0, 10, 80, 80] as [number, number, number, number] },
      { text: '中文二', bbox: [0, 120, 80, 200] as [number, number, number, number] },
      { text: '中文三', bbox: [0, 220, 80, 400] as [number, number, number, number] },
      { text: '中文四', bbox: [0, 1400, 80, 1500] as [number, number, number, number] },
      { text: '中文五', bbox: [0, 1600, 80, 1750] as [number, number, number, number] },
      { text: '中文六', bbox: [0, 1800, 80, 1900] as [number, number, number, number] },
    ]
    const ys = findSafeSplitYs(height, blocks)
    assert.equal(ys.length, 1)
    assert.ok(ys[0] > 450 && ys[0] < 1350)
    const ranges = splitYRanges(height, ys)
    assert.equal(ranges.length, 2)
  })

  it('shifts OCR boxes into the cropped part', () => {
    const blocks = [
      { text: '上', bbox: [4, 10, 20, 30] as [number, number, number, number] },
      { text: '下', bbox: [4, 1200, 20, 1230] as [number, number, number, number] },
    ]
    const lower = adjustOcrBlocksForPart(blocks, 1000, 2000)
    assert.equal(lower.length, 1)
    assert.equal(lower[0].text, '下')
    assert.deepEqual(lower[0].bbox, [4, 200, 20, 230])
  })
})
