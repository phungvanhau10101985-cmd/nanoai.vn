import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classifyImage, convertJinWeightText, hasSizeTableContext, localBlocksNeedDraw } from './image-localization-classifier'
import type { ImageLocOcrBlock } from './image-localization-types'
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
    const blocks: ImageLocOcrBlock[] = [
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

  it('keeps a product banner local when the only overlap is a model code', () => {
    const out = classifyImage(
      [
        { text: 'YONGCHUANG', bbox: [43, 91, 151, 105] },
        { text: '2W31', bbox: [585, 686, 732, 726] },
        { text: '好阀选永创用心来创造50GBN', bbox: [37, 723, 748, 788] },
      ],
      [],
      'https://example.com/valve.jpg'
    )
    assert.equal(out.type, 'local')
  })

  it('uses overlap against the smaller box like 188', () => {
    const out = classifyImage(
      [
        { text: '显瘦显高', bbox: [0, 0, 120, 60] },
        { text: '轻盈舒适', bbox: [20, 10, 80, 40] },
      ],
      [],
      'https://example.com/shoe.jpg'
    )
    assert.equal(out.type, 'gemini')
    assert.ok(Number(out.details.overlap_ratio) > 0.05)
  })

  it('draws size charts and laundry guides instead of deleting them', () => {
    const size = localBlocksNeedDraw([
      { text: '尺码表', bbox: [0, 0, 40, 12] },
      { text: 'S', bbox: [0, 14, 8, 22] },
      { text: 'M', bbox: [10, 14, 18, 22] },
      { text: 'L', bbox: [20, 14, 28, 22] },
      { text: '50cm', bbox: [0, 24, 20, 32] },
    ])
    assert.equal(size.action, 'draw')
    assert.ok(size.blocks.some((block) => block.text === '尺码表'))
    const laundry = localBlocksNeedDraw([
      { text: '洗涤说明', bbox: [0, 0, 80, 16] },
      { text: '手洗', bbox: [0, 20, 40, 32] },
    ])
    assert.equal(laundry.action, 'draw')
  })

  it('ignores isolated one-Hanzi OCR blocks like 188 translator', () => {
    const local = localBlocksNeedDraw([
      { text: '新款女装', bbox: [0, 0, 80, 20] },
      { text: '荐', bbox: [90, 0, 100, 20] },
    ])
    assert.equal(local.action, 'deleted', 'urgent keywords must still win before one-Hanzi filtering')

    const draw = localBlocksNeedDraw(
      [
        { text: '新款女装', bbox: [0, 0, 80, 20] },
        { text: '春', bbox: [90, 0, 100, 20] },
      ],
    )
    assert.equal(draw.action, 'draw')
    assert.deepEqual(draw.blocks.map((block) => block.text), ['新款女装'])
  })

  it('erases a return-policy cluster and still translates the other Chinese', () => {
    const blocks: ImageLocOcrBlock[] = [
      { text: '商品信息', bbox: [0, 0, 40, 12] },
      { text: '特殊靴子订制都不退换', bbox: [200, 40, 320, 52] },
      { text: '鞋面材质:漆皮', bbox: [0, 80, 120, 96] },
    ]
    const classified = classifyImage(blocks, [], 'https://example.com/boot.jpg')
    assert.notEqual(classified.type, 'delete')
    const local = localBlocksNeedDraw(blocks)
    assert.equal(local.action, 'draw')
    assert.equal(local.blocks.find((block) => block.bbox[1] === 40)?.text, '')
    assert.equal(local.blocks.some((block) => block.text === '商品信息'), true)
    assert.equal(local.blocks.some((block) => block.text.includes('鞋面材质')), true)
  })

  it('still deletes the image when another block has an urgent keyword', () => {
    const local = localBlocksNeedDraw([
      { text: '都不退换', bbox: [0, 0, 40, 12] },
      { text: '热荐爆款', bbox: [0, 20, 80, 32] },
    ])
    assert.equal(local.action, 'deleted')
  })

  it('erases factory lines and still translates the other Chinese', () => {
    const out = localBlocksNeedDraw([
      { text: '源头工厂', bbox: [10, 20, 90, 40] },
      { text: '不易起球', bbox: [10, 80, 90, 100] },
      { text: '杰仕西服源头工厂', bbox: [10, 120, 140, 140] },
    ])
    assert.equal(out.action, 'draw')
    assert.equal(out.blocks.find((block) => block.bbox[1] === 20)?.text, '')
    assert.equal(out.blocks.find((block) => block.text === '不易起球')?.text, '不易起球')
    assert.equal(out.blocks.find((block) => block.bbox[1] === 120)?.text, '杰仕西服')
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
