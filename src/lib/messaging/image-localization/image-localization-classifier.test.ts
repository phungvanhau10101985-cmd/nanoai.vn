import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classifyImage, convertJinWeightText, hasSizeTableContext, localBlocksNeedDraw } from './image-localization-classifier'
import { collectInventoryImageRefs, uniqueImageUrls } from './collect-image-refs'
import { normalizeImageUrl } from './image-localization-config'

describe('image localization classifier', () => {
  it('deletes images with urgent promo keywords (荐)', () => {
    const out = classifyImage([{ text: '热荐爆款', bbox: [0, 0, 10, 10] }], [], 'https://example.com/a.jpg')
    assert.equal(out.type, 'delete')
    assert.equal(out.details.detected_keyword, '荐')
  })

  it('keeps images without enough Hanzi', () => {
    const out = classifyImage([{ text: 'SKU 12345', bbox: [0, 0, 10, 10] }], [], 'https://example.com/a.jpg')
    assert.equal(out.type, 'keep')
  })

  it('detects a size table', () => {
    const blocks = [
      { text: '尺码表', bbox: [0, 0, 20, 10] },
      { text: '胸围', bbox: [0, 12, 20, 20] },
      { text: 'S', bbox: [22, 12, 30, 20] },
      { text: 'M', bbox: [32, 12, 40, 20] },
      { text: 'L', bbox: [42, 12, 50, 20] },
      { text: '50cm', bbox: [0, 22, 20, 30] },
    ]
    assert.equal(hasSizeTableContext(blocks), true)
  })

  it('converts 斤 to kg', () => {
    assert.equal(convertJinWeightText('约 2 斤'), '约 1 kg')
    assert.equal(convertJinWeightText('1.5斤'), '0.75 kg')
  })

  it('marks size/laundry for delete in local-only mode', () => {
    const blocks = [
      { text: '尺码表', bbox: [0, 0, 40, 12] },
      { text: 'S', bbox: [0, 14, 8, 22] },
      { text: 'M', bbox: [10, 14, 18, 22] },
      { text: 'L', bbox: [20, 14, 28, 22] },
      { text: '50cm', bbox: [0, 24, 20, 32] },
    ]
    const local = localBlocksNeedDraw(blocks, { deleteSizeAndLaundry: true })
    assert.equal(local.action, 'deleted')
  })
})

describe('collect inventory image refs', () => {
  it('collects O/P/Q/T-equivalent URLs and unique-normalizes', () => {
    const refs = collectInventoryImageRefs({
      image_url: '//cdn.example/main.jpg',
      colors_json: [{ name: 'red', img: 'https://cdn.example/color.jpg' }],
      gallery_urls: ['https://cdn.example/g1.jpg', 'https://cdn.example/g1.jpg'],
      detail_image_urls: ['https://cdn.example/d1.jpg'],
      material_detail_image_url: 'https://cdn.example/mat.jpg',
    })
    assert.equal(refs.some((r) => r.bucket === 'main_image'), true)
    assert.equal(refs.some((r) => r.bucket === 'colors'), true)
    assert.equal(refs.some((r) => r.bucket === 'gallery'), true)
    assert.equal(refs.some((r) => r.bucket === 'detail'), true)
    assert.equal(refs.some((r) => r.bucket === 'material'), true)
    const urls = uniqueImageUrls(refs, 80)
    assert.equal(urls.includes(normalizeImageUrl('//cdn.example/main.jpg')), true)
    assert.equal(urls.filter((u) => u === 'https://cdn.example/g1.jpg').length, 1)
  })
})
